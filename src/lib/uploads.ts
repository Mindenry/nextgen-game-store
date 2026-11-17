import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env, runtimeMode } from "@/lib/env";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 5 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export async function saveUpload(input: {
  file: File;
  folder: "slips" | "products";
  ownerId: string;
}): Promise<string> {
  const { file, folder, ownerId } = input;
  if (!file || file.size === 0) throw new UploadError("Choose a file to upload.");
  if (file.size > MAX_BYTES) throw new UploadError("Files must be 5 MB or smaller.");
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new UploadError("Only JPG, PNG or WebP images are allowed.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Verify magic bytes so a renamed file cannot bypass the MIME check.
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!isJpeg && !isPng && !isWebp) throw new UploadError("The file is not a valid image.");

  const name = `${randomUUID()}.${ext}`;

  if (runtimeMode === "supabase" && env.supabaseServiceKey) {
    const client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const path = `${folder}/${ownerId}/${name}`;
    const { error } = await client.storage.from(env.supabaseBucket).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new UploadError(`Upload failed: ${error.message}`);
    if (folder === "products") {
      const { data } = client.storage.from(env.supabaseBucket).getPublicUrl(path);
      return data.publicUrl;
    }
    return `sb://${env.supabaseBucket}/${path}`;
  }

  if (env.nodeEnv === "production") {
    throw new UploadError(
      "File storage is not configured. Set Supabase Storage credentials for production uploads.",
    );
  }
  const folderPath = join(process.cwd(), ".data", "uploads", folder, ownerId);
  await mkdir(folderPath, { recursive: true });
  await writeFile(join(folderPath, name), bytes);
  return `/api/files/${folder}/${ownerId}/${name}`;
}

/** Read a stored upload for server-side verification (never exposed to clients). */
export async function readUploadBytes(ref: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!ref) return null;
  try {
    if (ref.startsWith("/api/files/")) {
      const segments = ref.replace("/api/files/", "").split("/").map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, ""));
      if (segments.length < 3 || segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
      const [folder, ownerId, file] = segments;
      if (!["slips", "products"].includes(folder)) return null;
      const base = resolve(process.cwd(), ".data", "uploads");
      const target = resolve(base, join(folder, ownerId, file));
      if (!target.startsWith(base)) return null;
      const bytes = await readFile(target);
      const extension = file.split(".").pop()?.toLowerCase();
      return { bytes, contentType: extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg" };
    }
    if (ref.startsWith("sb://")) {
      const rest = ref.slice(5);
      const slash = rest.indexOf("/");
      if (slash < 0 || !env.supabaseServiceKey) return null;
      const bucket = rest.slice(0, slash);
      const path = rest.slice(slash + 1);
      const client = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) return null;
      return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
    }
    if (ref.startsWith("https://") || ref.startsWith("http://")) {
      const response = await fetch(ref, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 6 * 1024 * 1024) return null;
      return { bytes, contentType: response.headers.get("content-type") || "image/jpeg" };
    }
  } catch (error) {
    console.error("[storage] failed to read upload", error);
  }
  return null;
}

export async function getFileUrl(ref: string, expiresIn = 3600): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("/")) return ref;
  if (!ref.startsWith("sb://")) return null;
  const rest = ref.slice(5);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!env.supabaseServiceKey) return null;
  const client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("[storage] failed to sign url", error.message);
    return null;
  }
  return data.signedUrl;
}
