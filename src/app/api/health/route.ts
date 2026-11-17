import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { runtimeMode, setupStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database = false;
  try {
    const row = await one<{ ok: number }>("select 1 as ok");
    database = row?.ok === 1;
  } catch (error) {
    console.error("[health] database check failed", error);
  }

  const body = {
    ok: database,
    mode: runtimeMode,
    database,
    latencyMs: Date.now() - started,
    checks: {
      encryption: setupStatus.encryptionConfigured,
      promptPay: setupStatus.promptPayConfigured,
      webhook: setupStatus.webhookConfigured,
      email: setupStatus.emailConfigured,
      cron: setupStatus.cronConfigured,
      storage: setupStatus.storage,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: database ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
