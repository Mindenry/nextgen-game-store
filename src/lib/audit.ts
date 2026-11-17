import "server-only";
import { headers } from "next/headers";
import type { Queryable } from "@/lib/db";

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Audit logging must never block the primary business operation, but failures
 * are reported to the server console so they are not silently lost.
 * Pass the transaction handle when called inside a DB transaction.
 */
export async function audit(input: AuditInput, tx?: Queryable): Promise<void> {
  try {
    const h = await headers();
    const sql = `insert into audit_logs(actor_id, actor_email, action, entity_type, entity_id, before, after, ip, user_agent)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`;
    const params = [
      input.actorId ?? null,
      input.actorEmail ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      h.get("user-agent")?.slice(0, 300) ?? null,
    ];
    if (tx) {
      await tx.query(sql, params);
    } else {
      const { run } = await import("@/lib/db");
      await run(sql, params);
    }
  } catch (error) {
    console.error("[audit] failed to write log", input.action, error);
  }
}
