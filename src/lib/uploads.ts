import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
