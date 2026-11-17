import "server-only";
import type { Queryable } from "@/lib/db";

export type NotificationInput = {
  userId: string;
  type:
    | "order_created"
    | "payment_received"
    | "deposit_completed"
    | "purchase_completed"
    | "topup_completed"
    | "topup_failed"
    | "refund_completed"
    | "support_reply"
    | "promotion"
    | "account"
    | "security";
  title: string;
  body?: string;
  link?: string;
};

/** Pass the transaction handle when notifying inside a DB transaction. */
export async function notify(input: NotificationInput, tx?: Queryable): Promise<void> {
  const sql = `insert into notifications(user_id, type, title, body, link) values ($1, $2, $3, $4, $5)`;
  const params = [input.userId, input.type, input.title, input.body ?? null, input.link ?? null];
  if (tx) {
    await tx.query(sql, params);
  } else {
    const { run } = await import("@/lib/db");
    await run(sql, params);
  }
}

export async function notifyMany(
  users: string[],
  input: Omit<NotificationInput, "userId">,
  tx?: Queryable,
): Promise<void> {
  for (const userId of users) await notify({ ...input, userId }, tx);
}
