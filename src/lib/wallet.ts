import "server-only";
import type { Queryable } from "@/lib/db";
import { one } from "@/lib/db";
import { toMinor, toNumericString } from "@/lib/money";
import { randomUUID } from "node:crypto";

export type WalletTxType =
  | "deposit"
  | "purchase"
  | "refund"
  | "admin_credit"
  | "admin_debit"
  | "reversal";

export interface WalletTxnInput {
  userId: string;
  amountMinor: number;
  type: WalletTxType;
  description: string;
  paymentId?: string | null;
  orderId?: string | null;
  adminId?: string | null;
  metadata?: Record<string, unknown>;
  reference?: string;
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient wallet balance.");
    this.name = "InsufficientFundsError";
  }
}

export async function ensureWallet(tx: Queryable, userId: string): Promise<void> {
  await tx.query("insert into wallets(user_id) values ($1) on conflict (user_id) do nothing", [userId]);
}

/**
 * Applies a signed ledger entry and returns the resulting balance.
 * Must be called inside a transaction. The wallet row is locked so concurrent
 * purchases cannot overdraw, and the ledger is the source of truth.
 */
export async function applyWalletEntry(tx: Queryable, input: WalletTxnInput): Promise<{
  balanceMinor: number;
  transactionId: string;
  reference: string;
}> {
  await ensureWallet(tx, input.userId);
  const wallet = await one<{ balance: string }>(
    "select balance from wallets where user_id = $1 for update",
    [input.userId],
    tx,
  );
  const current = toMinor(wallet?.balance ?? "0");
  const next = current + input.amountMinor;
  if (next < 0) throw new InsufficientFundsError();

  const reference = input.reference ?? `WT-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const inserted = await one<{ id: string }>(
    `insert into wallet_transactions
       (user_id, type, amount, balance_after, reference, payment_id, order_id, admin_id, description, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     returning id`,
    [
      input.userId,
      input.type,
      toNumericString(input.amountMinor),
      toNumericString(next),
      reference,
      input.paymentId ?? null,
      input.orderId ?? null,
      input.adminId ?? null,
      input.description,
      JSON.stringify(input.metadata ?? {}),
    ],
    tx,
  );

  await tx.query("update wallets set balance = $1, updated_at = now() where user_id = $2", [
    toNumericString(next),
    input.userId,
  ]);
  return { balanceMinor: next, transactionId: inserted!.id, reference };
}

export async function getWallet(userId: string) {
  await one("insert into wallets(user_id) values ($1) on conflict (user_id) do nothing", [userId]);
  const wallet = await one<{ balance: string; updated_at: string }>(
    "select balance, updated_at from wallets where user_id = $1",
    [userId],
  );
  return { balance: wallet?.balance ?? "0.00", balanceMinor: toMinor(wallet?.balance ?? "0"), updatedAt: wallet?.updated_at ?? null };
}

export async function walletStats(userId: string) {
  const row = await one<{
    total_deposits: string;
    total_spent: string;
    pending_deposits: number;
  }>(
    `select
       coalesce((select sum(amount) from wallet_transactions where user_id = $1 and type = 'deposit' and status = 'completed'), 0) as total_deposits,
       coalesce((select sum(-amount) from wallet_transactions where user_id = $1 and type = 'purchase'), 0) as total_spent,
       (select count(*)::int from payments where user_id = $1 and purpose = 'wallet_deposit' and status in ('PENDING','VERIFYING','MANUAL_REVIEW')) as pending_deposits`,
    [userId],
  );
  return {
    totalDeposits: row?.total_deposits ?? "0",
    totalSpent: row?.total_spent ?? "0",
    pendingDeposits: Number(row?.pending_deposits ?? 0),
  };
}

export async function listWalletTransactions(userId: string, limit = 50) {
  return (await import("@/lib/db")).many<{
    id: string;
    type: string;
    amount: string;
    balance_after: string;
    reference: string;
    status: string;
    description: string;
    created_at: string;
    order_number: string | null;
  }>(
    `select wt.id, wt.type, wt.amount, wt.balance_after, wt.reference, wt.status, wt.description,
            wt.created_at, o.order_number
     from wallet_transactions wt
     left join orders o on o.id = wt.order_id
     where wt.user_id = $1
     order by wt.created_at desc limit $2`,
    [userId, limit],
  );
}
