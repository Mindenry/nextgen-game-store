import "server-only";
import { one, run } from "@/lib/db";

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

/**
 * Atomic fixed-window rate limiter backed by Postgres, so it works across
 * serverless instances. Fails open only if the limiter itself errors.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (process.env.E2E_BYPASS_RATE_LIMIT === "true" && process.env.NODE_ENV !== "production") {
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowSeconds * 1000) };
  }
  try {
    const row = await one<{ count: number; reset_at: string }>(
      `insert into rate_limits(bucket, count, reset_at)
       values ($1, 1, now() + make_interval(secs => $2::int))
       on conflict (bucket) do update
         set count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
             reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
       returning count, reset_at`,
      [bucket, windowSeconds],
    );
    const count = Number(row?.count ?? 1);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(row?.reset_at ?? Date.now() + windowSeconds * 1000),
    };
  } catch (error) {
    console.error("[rate-limit] failed", error);
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowSeconds * 1000) };
  }
}

export async function cleanupRateLimits(): Promise<void> {
  await run("delete from rate_limits where reset_at < now() - interval '1 day'");
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "unknown";
}
