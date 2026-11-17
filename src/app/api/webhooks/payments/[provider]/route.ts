import { NextResponse } from "next/server";
import { ingestWebhook } from "@/lib/payments";

export const dynamic = "force-dynamic";

const MAX_BODY = 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!/^[a-z0-9_]{2,40}$/.test(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const result = await ingestWebhook({
    providerId: provider,
    rawBody,
    signature: request.headers.get("x-ngs-signature"),
    sourceIp,
  });
  return NextResponse.json({ received: result.ok, message: result.message }, { status: result.httpStatus });
}
