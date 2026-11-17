import "server-only";
import { many, one, run, type Row } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { parseBankStatement, type ParsedStatementRow } from "@/lib/bank/statement";
import { getSettings } from "@/lib/settings";

interface BankTxRow extends Row {
  id: string;
  bank: string | null;
  amount: string;
  occurred_at: string;
  description: string | null;
  counterparty: string | null;
  slip_reference: string | null;
  payment_id: string | null;
  external_id: string;
  raw: string | null;
}

interface OpenPaymentRow extends Row {
  id: string;
  reference: string;
  amount: string;
  purpose: string;
  status: string;
  created_at: string;
  user_id: string;
}

export interface ImportSummary {
  importId: string;
  read: number;
  imported: number;
  duplicates: number;
  credits: number;
  debits: number;
  matched: number;
  ambiguous: number;
  warnings: string[];
}

export interface MatchSummary {
  scanned: number;
  matched: number;
  ambiguous: number;
  details: Array<{ transactionId: string; paymentReference: string; amount: string; method: string }>;
}

function sameAmount(a: string | number, b: string | number): boolean {
  return toMinor(String(a)) === toMinor(String(b));
}

function referencesPayment(tx: BankTxRow, payment: OpenPaymentRow): boolean {
  const haystack = `${tx.description ?? ""} ${tx.slip_reference ?? ""}`.toUpperCase();
  return Boolean(payment.reference) && haystack.includes(payment.reference.toUpperCase());
}

function minutesBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}

/**
 * Claims an unmatched bank transaction for a payment, then settles the payment.
 * The claim is a conditional update so two workers can never credit the same
 * bank credit twice. If settlement fails, the claim is released again.
 */
async function claimAndSettle(input: {
  transactionId: string;
  paymentId: string;
  method: string;
  adminId?: string | null;
  note?: string;
}): Promise<boolean> {
  const claimed = await one<{ id: string }>(
    `update bank_transactions
        set payment_id = $2, matched_at = now(), match_method = $3, matched_by = $4
      where id = $1 and payment_id is null
      returning id`,
    [input.transactionId, input.paymentId, input.method, input.adminId ?? null],
  );
  if (!claimed) return false;

  try {
    // Imported lazily so payments/index.ts can import this module without a
    // circular top-level dependency.
    const { settlePayment } = await import("@/lib/payments");
    await settlePayment({
      paymentId: input.paymentId,
      source: "reconcile",
      reviewerId: input.adminId ?? null,
      note: input.note ?? `Matched to a bank credit (${input.method})`,
    });
    return true;
  } catch (error) {
    console.error("[bank] settle failed, releasing bank match", error);
    await run(
      `update bank_transactions set payment_id = null, matched_at = null, match_method = null, matched_by = null
        where id = $1 and payment_id = $2`,
      [input.transactionId, input.paymentId],
    );
    return false;
  }
}

/** Imports a statement file and (when enabled) auto-matches it to open payments. */
export async function importBankStatement(input: {
  text: string;
  fileName?: string | null;
  bank?: string | null;
  adminId: string;
}): Promise<ImportSummary> {
  const parsed = parseBankStatement(input.text);
  const created = await one<{ id: string }>(
    `insert into bank_statement_imports(bank, file_name, row_count, created_by)
     values ($1,$2,$3,$4) returning id`,
    [input.bank || "generic", input.fileName ?? null, parsed.rows.length, input.adminId],
  );
  if (!created) throw new Error("Could not create the import record.");

  let imported = 0;
  let duplicates = 0;
  for (const row of parsed.rows) {
    const inserted = await one<{ id: string }>(
      `insert into bank_transactions
         (source, bank, external_id, direction, amount, occurred_at, description, counterparty,
          slip_reference, import_id, raw)
       values ('csv',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (source, external_id) do nothing
       returning id`,
      [
        input.bank || null,
        row.externalId,
        row.direction,
        row.amount.toFixed(2),
        row.occurredAt,
        row.description,
        row.counterparty,
        row.paymentReference,
        created.id,
        row.raw,
      ],
    );
    if (inserted) imported += 1;
    else duplicates += 1;
  }

  const settings = await getSettings();
  const autoMatch = settings["bank.auto_match_enabled"] !== false;
  const summary = autoMatch
    ? await autoMatchTransactions({ importId: created.id })
    : { scanned: 0, matched: 0, ambiguous: 0, details: [] };

  const credits = parsed.rows.filter((row) => row.direction === "credit").length;
  await run(
    `update bank_statement_imports set import_count = $2, matched_count = $3 where id = $1`,
    [created.id, imported, summary.matched],
  );

  return {
    importId: created.id,
    read: parsed.rows.length,
    imported,
    duplicates,
    credits,
    debits: parsed.rows.length - credits,
    matched: summary.matched,
    ambiguous: summary.ambiguous,
    warnings: parsed.warnings,
  };
}

/**
 * Auto-matches unmatched incoming credits to open payments with the same amount.
 * A match is only automatic when the payment reference appears in the statement
 * description, or when exactly one open payment has that amount inside the time
 * window. Anything ambiguous is left for a human.
 */
export async function autoMatchTransactions(input?: {
  importId?: string;
  windowMinutes?: number;
}): Promise<MatchSummary> {
  const settings = await getSettings();
  const windowMinutes =
    input?.windowMinutes ??
    (Number.isFinite(Number(settings["bank.match_window_minutes"]))
      ? Number(settings["bank.match_window_minutes"])
      : 1440);

  const transactions = input?.importId
    ? await many<BankTxRow>(
        `select * from bank_transactions where payment_id is null and direction = 'credit' and import_id = $1
         order by occurred_at asc limit 1000`,
        [input.importId],
      )
    : await queryTx();
  const txs = transactions;

  const payments = await queryOpenPayments();
  const details: MatchSummary["details"] = [];
  let matched = 0;
  let ambiguous = 0;

  for (const tx of txs) {
    const byReference = payments.filter((payment) => referencesPayment(tx, payment));
    const byAmount = payments.filter((payment) => sameAmount(payment.amount, tx.amount));

    let target: OpenPaymentRow | null = null;
    let method = "";

    if (byReference.length === 1) {
      target = byReference[0];
      method = "reference";
    } else if (byReference.length === 0) {
      const inWindow = byAmount.filter((payment) => minutesBetween(payment.created_at, tx.occurred_at) <= windowMinutes);
      if (inWindow.length === 1) {
        target = inWindow[0];
        method = "amount_time";
      } else if (inWindow.length > 1) {
        ambiguous += 1;
        continue;
      }
    } else {
      ambiguous += 1;
      continue;
    }

    if (!target) continue;

    const ok = await claimAndSettle({
      transactionId: tx.id,
      paymentId: target.id,
      method,
      note: `Matched to bank credit ${tx.external_id}`,
    });
    if (ok) {
      matched += 1;
      details.push({ transactionId: tx.id, paymentReference: target.reference, amount: tx.amount, method });
    }
  }

  return { scanned: txs.length, matched, ambiguous, details };
}

async function queryTx(): Promise<BankTxRow[]> {
  return many<BankTxRow>(
    `select * from bank_transactions where payment_id is null and direction = 'credit'
     order by occurred_at desc limit 500`,
  );
}

async function queryOpenPayments(): Promise<OpenPaymentRow[]> {
  return many<OpenPaymentRow>(
    `select id, reference, amount, purpose, status, created_at, user_id
       from payments
      where status in ('PENDING','VERIFYING','MANUAL_REVIEW')
      order by created_at desc
      limit 1000`,
  );
}

/** Manual link from the admin reconciliation screen. */
export async function matchTransactionToPayment(input: {
  transactionId: string;
  paymentId: string;
  adminId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const tx = await one<BankTxRow>("select * from bank_transactions where id = $1", [input.transactionId]);
  if (!tx) return { ok: false, error: "Bank transaction not found." };
  if (tx.payment_id) return { ok: false, error: "That bank transaction is already matched." };
  if (tx.direction !== "credit") return { ok: false, error: "Only incoming credits can settle a payment." };

  const payment = await one<OpenPaymentRow>(
    "select id, reference, amount, purpose, status, created_at, user_id from payments where id = $1",
    [input.paymentId],
  );
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.status === "PAID") return { ok: false, error: "That payment is already paid." };
  if (!sameAmount(payment.amount, tx.amount)) {
    return { ok: false, error: `Amounts differ: bank ${tx.amount} vs payment ${payment.amount}.` };
  }

  const ok = await claimAndSettle({
    transactionId: input.transactionId,
    paymentId: input.paymentId,
    method: "manual",
    adminId: input.adminId,
    note: `Manually matched to bank credit ${tx.external_id}`,
  });
  return ok ? { ok: true } : { ok: false, error: "Could not settle the payment." };
}

/**
 * Used right after a slip is uploaded: if the merchant's statement already has an
 * incoming credit matching this payment, the money really arrived, so the wallet
 * can be credited. Otherwise the slip stays in manual review.
 */
export async function findBankCreditForPayment(paymentId: string): Promise<{
  matched: boolean;
  amount?: string;
  method?: string;
}> {
  const payment = await one<OpenPaymentRow>(
    "select id, reference, amount, purpose, status, created_at, user_id from payments where id = $1",
    [paymentId],
  );
  if (!payment || payment.status === "PAID") return { matched: false };

  const settings = await getSettings();
  const windowMinutes = Number(settings["bank.match_window_minutes"] ?? 1440);

  const rows = await many<BankTxRow>(
    `select * from bank_transactions
      where payment_id is null and direction = 'credit'
        and amount = $1::numeric
      order by occurred_at desc limit 50`,
    [payment.amount],
  );
  const candidates = rows;
  if (candidates.length === 0) return { matched: false };

  const byReference = candidates.filter((tx) => referencesPayment(tx, payment));
  let target: BankTxRow | null = null;
  let method = "";
  if (byReference.length === 1) {
    target = byReference[0];
    method = "reference";
  } else {
    const inWindow = candidates.filter((tx) => minutesBetween(payment.created_at, tx.occurred_at) <= windowMinutes);
    if (inWindow.length === 1) {
      target = inWindow[0];
      method = "amount_time";
    }
  }
  if (!target) return { matched: false };

  const ok = await claimAndSettle({
    transactionId: target.id,
    paymentId: payment.id,
    method,
    note: `Slip upload matched to bank credit ${target.external_id}`,
  });
  return ok ? { matched: true, amount: target.amount, method } : { matched: false };
}

export type { ParsedStatementRow };
