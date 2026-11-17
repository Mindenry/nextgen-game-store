import "server-only";
import { one } from "@/lib/db";

/**
 * Idempotency guard for money-moving operations. The first request claims the
 * key; concurrent duplicate requests are rejected rather than executed twice.
 */
export async function withIdempotency<T>(
  key: string,
  scope: string,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const normalized = `${scope}:${key}`.slice(0, 200);
  const inserted = await one<{ key: string }>(
    `insert into idempotency_keys(key, scope, user_id, expires_at)
     values ($1, $2, $3, now() + interval '1 hour')
     on conflict (key) do nothing
     returning key`,
    [normalized, scope, userId],
  );

  if (!inserted) {
    const existing = await one<{ response: unknown; created_at: string }>(
      "select response, created_at from idempotency_keys where key = $1",
      [normalized],
    );
    if (existing?.response) return existing.response as T;
    throw new Error("This request is already being processed. Please wait a moment.");
  }

  try {
    const result = await fn();
    await one(
      "update idempotency_keys set response = $2::jsonb where key = $1 returning key",
      [normalized, JSON.stringify(result)],
    );
    return result;
  } catch (error) {
    await one("delete from idempotency_keys where key = $1 returning key", [normalized]);
    throw error;
  }
}
