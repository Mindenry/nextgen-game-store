"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { one, run, withTransaction } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { toMinor, toNumericString } from "@/lib/money";
import { applyWalletEntry } from "@/lib/wallet";
import { notify } from "@/lib/notifications";
import { approveManualPayment, rejectManualPayment, expireStalePayments, verifySlipForPayment } from "@/lib/payments";
import { getSettings, setSettings } from "@/lib/settings";

export type AdminResult = { error?: string; success?: string };

function s(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

async function guard(permission: string) {
  const user = await requireStaff();
  if (!can(user, permission)) throw new Error("You do not have permission to do that.");
  return user;
}

export async function approvePaymentAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.paymentsVerify);
    const paymentId = s(formData, "paymentId");
    const note = s(formData, "note") || "Verified against bank statement";
    await approveManualPayment({ paymentId, adminId: user.id, adminEmail: user.email, note });
    revalidatePath("/admin/payments");
    return { success: "Payment verified and credited." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not verify the payment." };
  }
}

export async function rejectPaymentAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.paymentsVerify);
    const paymentId = s(formData, "paymentId");
    const note = s(formData, "note");
    if (note.length < 5) return { error: "Give a rejection reason of at least 5 characters." };
    await rejectManualPayment({ paymentId, adminId: user.id, note });
    revalidatePath("/admin/payments");
    return { success: "Payment rejected and the customer was notified." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reject the payment." };
  }
}

export async function saveProviderAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.paymentsProviders);
    const id = s(formData, "providerId");
    const name = s(formData, "name");
    if (!id || !name) return { error: "Provider is required." };
    const enabled = formData.get("isEnabled") === "on";
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(s(formData, "config") || "{}") as Record<string, unknown>;
    } catch {
      return { error: "Provider config must be valid JSON." };
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return { error: "Provider config must be a JSON object." };
    }
    if (Object.keys(config).some((key) => /secret|password|token|private|key/i.test(key))) {
      return { error: "Do not put secrets in config. Use the encrypted secret field." };
    }
    const secret = s(formData, "secret");
    if (secret) {
      await run(
        "update payment_providers set name = $2, is_enabled = $3, config = $4::jsonb, secret_encrypted = $5, updated_at = now() where id = $1",
        [id, name, enabled, JSON.stringify(config), encryptSecret(secret)],
      );
    } else {
      await run(
        "update payment_providers set name = $2, is_enabled = $3, config = $4::jsonb, updated_at = now() where id = $1",
        [id, name, enabled, JSON.stringify(config)],
      );
    }
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payment_provider.update",
      entityType: "payment_provider",
      entityId: id,
      after: { enabled, secretRotated: Boolean(secret) },
    });
    revalidatePath("/admin/payment-providers");
    return { success: "Payment provider saved. Secrets are encrypted at rest." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the provider." };
  }
}

export async function adjustWalletAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.walletAdjust);
    const userId = s(formData, "userId");
    const direction = s(formData, "direction");
    const amountRaw = s(formData, "amount");
    const reason = s(formData, "reason");
    if (!userId) return { error: "Customer is required." };
    if (!["credit", "debit"].includes(direction)) return { error: "Choose credit or debit." };
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(amountRaw)) return { error: "Enter a valid amount." };
    if (reason.length < 5) return { error: "A reason of at least 5 characters is required." };
    const amount = toMinor(amountRaw);
    if (amount <= 0) return { error: "Amount must be greater than zero." };

    const result = await withTransaction(async (tx) => {
      const entry = await applyWalletEntry(tx, {
        userId,
        amountMinor: direction === "credit" ? amount : -amount,
        type: direction === "credit" ? "admin_credit" : "admin_debit",
        description: reason,
        adminId: user.id,
      });
      await notify(
        {
          userId,
          type: "account",
          title: direction === "credit" ? "Wallet credited" : "Wallet adjusted",
          body: `${direction === "credit" ? "+" : "-"}฿${amountRaw} — ${reason}`,
          link: "/dashboard/wallet",
        },
        tx,
      );
      await audit(
        {
          actorId: user.id,
          actorEmail: user.email,
          action: `wallet.${direction}`,
          entityType: "wallet",
          entityId: userId,
          after: { amount: toNumericString(amount), reason, balanceAfter: toNumericString(entry.balanceMinor) },
        },
        tx,
      );
      return entry;
    });
    revalidatePath("/admin/wallet");
    revalidatePath("/admin/customers");
    return { success: `Wallet adjusted. New balance ฿${(result.balanceMinor / 100).toFixed(2)}.` };
  } catch (error) {
    if (error instanceof Error && error.name === "InsufficientFundsError") {
      return { error: "A debit cannot take the wallet below zero." };
    }
    return { error: error instanceof Error ? error.message : "Could not adjust the wallet." };
  }
}

export async function saveSlipSettingsAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.settingsManage);
    const enabled = formData.get("slipEnabled") === "on";
    const autoApprove = formData.get("autoApprove") === "on";
    const selfAutoCredit = formData.get("selfAutoCredit") === "on";
    const branchId = s(formData, "branchId").slice(0, 60);
    const apiKey = s(formData, "apiKey");
    const existing = await getSettings();
    const existingKey = String(existing["slip.slipok_api_key"] ?? "");
    if (enabled && !branchId) return { error: "SlipOK Branch ID is required when verification is enabled." };
    const encryptedKey = apiKey ? encryptSecret(apiKey) : existingKey;
    if (enabled && !encryptedKey) {
      return { error: "SlipOK API key is required when verification is enabled." };
    }
    await setSettings(
      {
        "slip.enabled": enabled,
        "slip.auto_approve": autoApprove,
        "slip.self_auto_credit": selfAutoCredit,
        "slip.slipok_branch_id": branchId,
        "slip.slipok_api_key": encryptedKey,
        "slip.provider": "slipok",
      },
      user.id,
    );
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "settings.slip_verification_update",
      entityType: "system_settings",
      entityId: "slip",
      after: { enabled, autoApprove, selfAutoCredit, branchId, keyRotated: Boolean(apiKey) },
    });
    revalidatePath("/admin/payment-settings");
    revalidatePath("/admin/payments");
    return {
      success: enabled
        ? "SlipOK verification settings saved. New slips will be verified automatically."
        : "Slip verification disabled. Slips will require manual review.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save slip settings." };
  }
}

export async function verifySlipAction(paymentId: string): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.paymentsVerify);
    const result = await verifySlipForPayment(paymentId);
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payment.slip_verify",
      entityType: "payment",
      entityId: paymentId,
      after: {
        status: result.status,
        code: result.code ?? null,
        transRef: result.transRef ?? null,
        credited: result.credited,
      },
    });
    revalidatePath("/admin/payments");
    if (result.status === "verified") {
      return { success: result.credited ? "Slip verified and payment credited." : result.message };
    }
    return { error: result.message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not verify the slip." };
  }
}

export async function expirePaymentsAction(): Promise<AdminResult> {
  try {
    await guard(PERMISSIONS.paymentsView);
    const count = await expireStalePayments();
    revalidatePath("/admin/payments");
    return { success: `${count} expired payment(s) processed.` };
  } catch (error) {
    return { error: "Could not expire payments." };
  }
}

export async function savePaymentSettingsAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  try {
    const user = await guard(PERMISSIONS.settingsManage);
    const promptPayId = s(formData, "promptPayId").replace(/[^0-9]/g, "");
    if (promptPayId && ![10, 13, 15].includes(promptPayId.length)) {
      return { error: "PromptPay ID must be 10, 13 or 15 digits." };
    }
    const min = Number(s(formData, "minDeposit"));
    const max = Number(s(formData, "maxDeposit"));
    const expiry = Number(s(formData, "qrExpiry"));
    if (!Number.isFinite(min) || min < 1) return { error: "Minimum deposit must be at least 1." };
    if (!Number.isFinite(max) || max <= min) return { error: "Maximum deposit must be greater than the minimum." };
    if (!Number.isFinite(expiry) || expiry < 1 || expiry > 1440) return { error: "QR expiry must be 1–1440 minutes." };
    const activeProvider = s(formData, "activeProvider") || "promptpay_qr";
    const provider = await one<{ is_enabled: boolean }>("select is_enabled from payment_providers where id = $1", [activeProvider]);
    if (!provider?.is_enabled) return { error: "The selected active provider is disabled." };
    const truemoneyPhone = (
      s(formData, "truemoneyPhone") ||
      String((await getSettings())["truemoney.phone"] ?? "0812345678")
    ).replace(/[^0-9]/g, "");
    if (!/^0\d{9}$/.test(truemoneyPhone)) {
      return { error: "TrueMoney phone must be a 10-digit Thai mobile number (e.g. 0812345678)." };
    }

    await setSettings(
      {
        "payment.promptpay_id": promptPayId,
        "payment.receiver_name": s(formData, "receiverName") || "NEXTGEN GAME STORE",
        "payment.min_deposit": min,
        "payment.max_deposit": max,
        "payment.qr_expiry_minutes": expiry,
        "payment.active_provider": activeProvider,
        "truemoney.phone": truemoneyPhone,
      },
      user.id,
    );
    const truemoneyInstructions = `ส่งซองอั่งเปา TrueMoney มาที่เบอร์ ${truemoneyPhone} แล้ววางลิงก์ซองอั่งเปาในช่องด้านล่าง เจ้าหน้าที่จะ redeem และอนุมัติยอดให้`;
    await run(
      `update payment_providers set config = jsonb_set(coalesce(config, '{}'::jsonb), '{instructions}', to_jsonb($1::text)), updated_at = now()
       where id = 'truemoney_angpao'`,
      [truemoneyInstructions],
    );

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "settings.payment_update",
      entityType: "system_settings",
      entityId: "payment",
      after: { activeProvider, min, max, expiry, promptPayConfigured: Boolean(promptPayId) },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/payments");
    return { success: "Payment settings saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save payment settings." };
  }
}
