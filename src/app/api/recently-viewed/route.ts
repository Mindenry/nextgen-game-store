import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { RECENT_COOKIE } from "@/lib/recently-viewed";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  await getCurrentUser();
  let body: { productId?: string };
  try {
    body = (await request.json()) as { productId?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.productId || !UUID_RE.test(body.productId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const store = await cookies();
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(store.get(RECENT_COOKIE)?.value ?? "[]") as unknown;
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string" && UUID_RE.test(id));
  } catch {
    ids = [];
  }
  ids = [body.productId, ...ids.filter((id) => id !== body.productId)].slice(0, 8);
  store.set(RECENT_COOKIE, JSON.stringify(ids), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return NextResponse.json({ ok: true });
}
