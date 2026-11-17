import { readFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!Array.isArray(path) || path.length < 3) return new NextResponse("Not found", { status: 404 });
  const segments = path.map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, ""));
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const [folder, ownerId, file] = segments;
  if (!["slips", "products"].includes(folder)) return new NextResponse("Not found", { status: 404 });

  if (folder === "slips") {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });
    const isOwner = ownerId === user.id;
    const canReview = can(user, PERMISSIONS.paymentsVerify);
    if (!isOwner && !canReview) return new NextResponse("Forbidden", { status: 403 });
  }

  const base = resolve(process.cwd(), ".data", "uploads");
  const target = resolve(base, normalize(join(folder, ownerId, file)));
  if (!target.startsWith(base)) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(target);
    const extension = file.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": folder === "products" ? "public, max-age=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
