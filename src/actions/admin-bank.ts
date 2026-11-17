"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { autoMatchTransactions, importBankStatement, matchTransactionToPayment } from "@/lib/bank/reconcile";
import { setSettings } from "@/lib/settings";

export type BankResult = { error?: string; success?: string };

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function guard() {
  const user = await requireStaff();
  if (!can(user, PERMISSIONS.paymentsVerify) && !can(user, PERMISSIONS.settingsManage)) {
    throw new Error("You do not have permission to reconcile payments.");
  }
  return user;
}

const MAX_STATEMENT_BYTES = 3 * 1024 * 1024;

/** Upload a bank statement (CSV) exported from the merchant's own bank account. */
export async function importStatementAction(_prev: BankResult, formData: FormData): Promise<BankResult> {
  try {
    const user = await guard();
    const file = formData.get("statement");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a statement file exported from your bank (CSV or TSV)." };
    }
    if (file.size > MAX_STATEMENT_BYTES) {
      return { error: "Statements must be 3 MB or smaller. Export a shorter date range." };
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      return { error: "Use a CSV/TSV export. Excel files must be saved as CSV first." };
    }
    const text = await file.text();
    if (!text.trim()) return { error: "The statement file is empty." };

    const bank = s(formData, "bank") || "generic";
    const summary = await importBankStatement({ text, fileName: file.name, bank, adminId: user.id });

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payments.statement_import",
      entityType: "bank_statement_import",
      entityId: summary.importId,
      after: {
        bank,
        file: file.name,
        read: summary.read,
        imported: summary.imported,
        duplicates: summary.duplicates,
        matched: summary.matched,
      },
    });

    revalidatePath("/admin/bank-reconciliation");
    revalidatePath("/admin/payments");
    const detail = [
      `${summary.read} rows read`,
      `${summary.imported} new credits/debits stored`,
      summary.duplicates ? `${summary.duplicates} already imported` : null,
      summary.matched ? `${summary.matched} payment(s) verified and credited` : "no automatic matches",
      summary.ambiguous ? `${summary.ambiguous} need a manual decision` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { success: `Statement imported: ${detail}.` };
  } catch (error) {
    console.error("[bank] import failed", error);
    return { error: error instanceof Error ? error.message : "Could not import the statement." };
  }
}

/** Re-run matching for credits that are still unmatched. */
export async function runAutoMatchAction(_prev: BankResult): Promise<BankResult> {
  try {
    const user = await guard();
    const summary = await autoMatchTransactions();
    revalidatePath("/admin/bank-reconciliation");
    revalidatePath("/admin/payments");
    return {
      success: `Checked ${summary.scanned} unmatched credit(s): ${summary.matched} matched${
        summary.ambiguous ? `, ${summary.ambiguous} still ambiguous` : ""
      }.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not run matching." };
  }
}

/** Manually link a bank credit to a specific payment intent. */export async function matchBankTransactionAction(_prev: BankResult, formData: FormData): Promise<BankResult> {
  let matched = false;
  try {
    const user = await guard();
    const transactionId = s(formData, "transactionId");
    const paymentId = s(formData, "paymentId");
    if (!transactionId || !paymentId) return { error: "Choose both a bank credit and a payment." };

    const result = await matchTransactionToPayment({ transactionId, paymentId, adminId: user.id });
    if (!result.ok) return { error: result.error ?? "Could not match the payment." };

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payments.bank_match",
      entityType: "bank_transaction",
      entityId: transactionId,
      after: { paymentId },
    });
    revalidatePath("/admin/bank-reconciliation");
    revalidatePath("/admin/payments");
    matched = true;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not match the payment." };
  }
  // Redirect outside try/catch so the thrown redirect is not turned into an error.
  // The matched row disappears from the list, so the confirmation lives on the page banner.
  if (matched) redirect("/admin/bank-reconciliation?matched=1");
  return { error: "Could not match the payment." };
}

/** Matching behaviour: auto-match switch and the time window around a payment. */
export async function saveBankSettingsAction(_prev: BankResult, formData: FormData): Promise<BankResult> {
  try {
    const user = await guard();
    const autoMatch = formData.get("autoMatch") === "on";
    const windowMinutes = Number(s(formData, "windowMinutes"));
    if (!Number.isFinite(windowMinutes) || windowMinutes < 5 || windowMinutes > 20160) {
      return { error: "The match window must be between 5 and 20160 minutes." };
    }
    await setSettings(
      { "bank.auto_match_enabled": autoMatch, "bank.match_window_minutes": Math.round(windowMinutes) },
      user.id,
    );
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payments.bank_settings",
      entityType: "system_setting",
      entityId: "bank",
      after: { autoMatch, windowMinutes },
    });
    revalidatePath("/admin/bank-reconciliation");
    return { success: "Matching settings saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the settings." };
  }
}
