import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expireStalePayments } from "@/lib/payments";
import { cleanupRateLimits } from "@/lib/rate-limit";
import { safeEqualHex } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token.length > 0 && safeEqualHex(token, env.cronSecret);
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!env.cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set it before enabling reconciliation." },
      { status: 503 },
    );
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [expired] = await Promise.all([expireStalePayments(), cleanupRateLimits()]);
  return NextResponse.json({ ok: true, expiredPayments: expired, at: new Date().toISOString() });
}
