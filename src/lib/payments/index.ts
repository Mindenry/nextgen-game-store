import "server-only";
import QRCode from "qrcode";
import { many, one, withTransaction } from "@/lib/db";
import { decryptSecret, hmacSha256, safeEqualHex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getEnabledProvider, getPromptPayConfig, getSettings } from "@/lib/settings";
import { getSlipConfig, verifySlipImage } from "@/lib/slip-verification";
import { readUploadBytes } from "@/lib/uploads";
import { decodeSlipQr } from "@/lib/slip-qr";
import { parseSlipPayload, slipReference } from "@/lib/slip-payload";
import type { SlipOutcome } from "@/lib/slipok";
import { toMinor, toNumericString } from "@/lib/money";
import { newPaymentReference } from "@/lib/payments/promptpay";
import { applyWalletEntry } from "@/lib/wallet";
import { deliverOrder } from "@/lib/orders";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export type PaymentStatus =
  | "PENDING"
  | "VERIFYING"
  | "PAID"
  | "EXPIRED"
  | "FAILED"
  | "REJECTED"
  | "MANUAL_REVIEW"
  | "REFUNDED";

export class PaymentSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentSetupError";
  }
}

export class PaymentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConflictError";
  }
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  VERIFYING: "Verifying",
  PAID: "Paid",
  EXPIRED: "Expired",
  FAILED: "Failed",
  REJECTED: "Rejected",
  MANUAL_REVIEW: "Manual review",
  REFUNDED: "Refunded",
};

export type PaymentRow = {
  id: string;
  reference: string;
  user_id: string;
  order_id: string | null;
  purpose: "wallet_deposit" | "order";
  provider_id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  qr_payload: string | null;
  provider_ref: string | null;
  verification_source: string | null;
  evidence_url: string | null;
  slip_hash: string | null;
  slip_bank_ref: string | null;
  slip_verification: Record<string, unknown> | null;
  voucher_hash: string | null;
  voucher_url_encrypted: string | null;
  expires_at: string;
  paid_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: "#0B0F1A", light: "#FFFFFF" },
  });
}

async function resolveProvider(preferredId?: string) {
  const settings = await getSettings();
  const id = preferredId || String(settings["payment.active_provider"] ?? "promptpay_qr");
  const provider = await getEnabledProvider(id);
  if (!provider) throw new PaymentSetupError(`Payment provider "${id}" does not exist.`);
  if (!provider.is_enabled) {
    throw new PaymentSetupError(
      `Payment provider "${provider.name}" is disabled. Enable it in Admin → Payment Providers.`,
    );
  }
  return provider;
}

export async function createDeposit(input: {
  userId: string;
  amountMinor: number;
  providerId?: string;
  idempotencyKey?: string;
}): Promise<{
  paymentId: string;
  reference: string;
  qrDataUrl: string | null;
  instructions: string | null;
  expiresAt: string;
  providerName: string;
}> {
  const config = await getPromptPayConfig();
  const amountBaht = input.amountMinor / 100;
  if (amountBaht < config.minDeposit) {
    throw new PaymentSetupError(`Minimum deposit is ฿${config.minDeposit.toFixed(2)}.`);
  }
  if (amountBaht > config.maxDeposit) {
    throw new PaymentSetupError(`Maximum deposit is ฿${config.maxDeposit.toFixed(2)}.`);
  }

  const provider = await resolveProvider(input.providerId);
  const settings = await getSettings();
  const reference = newPaymentReference();
  const promptPayId = (config.promptPayId || env.promptPayId).trim();
  let qrPayload: string | null = null;
  let instructions: string | null = null;

  if (provider.kind === "promptpay") {
    if (!promptPayId) {
      throw new PaymentSetupError(
        "PromptPay ID is not configured. Set payment.promptpay_id in Admin → Settings.",
      );
    }
    qrPayload = (await import("@/lib/payments/promptpay")).buildPromptPayPayload({
      promptPayId,
      amountMinor: input.amountMinor,
      reference,
    });
  } else if (provider.kind === "manual") {
    const conf = provider.config as Record<string, unknown>;
    instructions =
      String(conf.instructions ?? "").trim() ||
      [
        conf.bank_name ? `Bank: ${conf.bank_name}` : null,
        conf.account_number ? `Account: ${conf.account_number}` : null,
        conf.account_name ? `Account name: ${conf.account_name}` : null,
        "Transfer the exact amount, then upload your slip for verification.",
      ]
        .filter(Boolean)
        .join("\n");
  } else if (provider.kind === "webhook" || provider.kind === "bank") {
    throw new PaymentSetupError(
      `${provider.name} is not available for automated QR creation yet. Configure PromptPay QR or use Manual Bank Transfer.`,
    );
  }

  const expiryMinutes = Number(settings["payment.qr_expiry_minutes"] ?? 15);
  const payment = await one<{ id: string; expires_at: string }>(
    `insert into payments(reference, user_id, purpose, provider_id, amount, status, qr_payload, expires_at, metadata)
     values ($1,$2,'wallet_deposit',$3,$4,'PENDING',$5, now() + make_interval(mins => $6::int), $7::jsonb)
     returning id, expires_at`,
    [
      reference,
      input.userId,
      provider.id,
      toNumericString(input.amountMinor),
      qrPayload,
      expiryMinutes,
      JSON.stringify({ requested_amount_minor: input.amountMinor }),
    ],
  );

  await audit({
    actorId: input.userId,
    action: "payment.deposit_created",
    entityType: "payment",
    entityId: payment!.id,
    after: { reference, amount: amountBaht, provider: provider.id },
  });

  return {
    paymentId: payment!.id,
    reference,
    qrDataUrl: qrPayload ? await qrDataUrl(qrPayload) : null,
    instructions,
    expiresAt: payment!.expires_at,
    providerName: provider.name,
  };
}

export async function getPaymentByReference(
  reference: string,
  userId?: string,
): Promise<PaymentRow | null> {
  const payment = await one<PaymentRow>("select * from payments where reference = $1", [reference]);
  if (!payment) return null;
  if (userId && payment.user_id !== userId) return null;
  return payment;
}

/**
 * Marks a payment as paid and applies its business effect exactly once.
 * The payment row lock makes duplicate webhooks and double approvals safe.
 */
export async function settlePayment(input: {
  paymentId: string;
  source: "webhook" | "manual" | "reconcile" | "slip";
  providerRef?: string | null;
  reviewerId?: string | null;
  note?: string | null;
  amountMinor?: number;
}): Promise<{ status: "paid" | "already_paid" | "manual_review"; orderNumber?: string }> {
  return withTransaction(async (tx) => {
    const payment = await one<PaymentRow>("select * from payments where id = $1 for update", [input.paymentId], tx);
    if (!payment) throw new PaymentConflictError("Payment not found.");
    if (payment.status === "PAID") return { status: "already_paid" as const };
    if (["REFUNDED", "REJECTED", "FAILED", "EXPIRED"].includes(payment.status) && input.source === "webhook") {
      throw new PaymentConflictError(`Payment is ${payment.status} and cannot be marked paid.`);
    }
    if (payment.status === "EXPIRED" && input.source === "manual") {
      // A slip may arrive after expiry; staff can still verify it explicitly.
    }
    if (input.amountMinor !== undefined && input.amountMinor !== toMinor(payment.amount)) {
      throw new PaymentConflictError("Paid amount does not match the payment intent.");
    }
    if (input.providerRef) {
      const duplicate = await one<{ id: string }>(
        "select id from payments where provider_id = $1 and provider_ref = $2 and id <> $3",
        [payment.provider_id, input.providerRef, payment.id],
        tx,
      );
      if (duplicate) throw new PaymentConflictError("This provider transaction was already used.");
    }

    if (payment.order_id) {
      const order = await one<{ order_number: string; payment_status: string; coupon_id: string | null; total: string }>(
        "select order_number, payment_status, coupon_id, total from orders where id = $1 for update",
        [payment.order_id],
        tx,
      );
      if (!order) throw new PaymentConflictError("Order not found.");
      if (order.payment_status === "paid") {
        await tx.query(
          `update payments set status = 'MANUAL_REVIEW', provider_ref = coalesce($2, provider_ref),
             review_note = 'Duplicate payment received for an already-paid order.', updated_at = now()
           where id = $1`,
          [payment.id, input.providerRef ?? null]
        );
        return { status: "manual_review" as const, orderNumber: order.order_number };
      }
    }

    await tx.query(
      `update payments set status = 'PAID', paid_at = now(), verification_source = $2,
         provider_ref = coalesce($3, provider_ref), reviewer_id = coalesce($4, reviewer_id),
         review_note = coalesce($5, review_note), reviewed_at = case when $4 is not null then now() else reviewed_at end,
         updated_at = now()
       where id = $1`,
      [payment.id, input.source, input.providerRef ?? null, input.reviewerId ?? null, input.note ?? null]
    );

    await audit(
      {
        actorId: input.reviewerId ?? null,
        action: "payment.paid",
        entityType: "payment",
        entityId: payment.id,
        before: { status: payment.status },
        after: { source: input.source, providerRef: input.providerRef ?? null },
      },
      tx,
    );

    if (payment.purpose === "wallet_deposit") {
      await applyWalletEntry(tx, {
        userId: payment.user_id,
        amountMinor: toMinor(payment.amount),
        type: "deposit",
        description: `Wallet top-up ${payment.reference}`,
        paymentId: payment.id,
        reference: `DEP-${payment.reference}`,
      });
      await notify(
        {
          userId: payment.user_id,
          type: "deposit_completed",
          title: "Wallet top-up completed",
          body: `฿${Number(payment.amount).toFixed(2)} was added to your wallet.`,
          link: "/dashboard/wallet",
        },
        tx,
      );
      return { status: "paid" as const };
    }

    if (payment.order_id) {
      const order = await one<{ order_number: string }>(
        "select order_number from orders where id = $1",
        [payment.order_id],
        tx,
      );
      await tx.query(
        `update orders set payment_status = 'paid', status = 'paid', paid_at = now(),
           payment_method = 'promptpay', updated_at = now()
         where id = $1 and payment_status <> 'paid'`,
        [payment.order_id]
      );
      await notify(
        {
          userId: payment.user_id,
          type: "payment_received",
          title: "Payment received",
          body: `Payment for ${order?.order_number ?? "your order"} was confirmed.`,
          link: `/dashboard/orders/${order?.order_number ?? ""}`,
        },
        tx,
      );
      await deliverOrder(tx, payment.order_id, input.reviewerId ?? null);
      return { status: "paid" as const, orderNumber: order?.order_number };
    }

    return { status: "paid" as const };
  });
}

async function notifySlipReviewers(payment: PaymentRow, title: string, body: string): Promise<void> {
  const admins = await many<{ id: string }>(
    `select p.id from profiles p join role_permissions rp on rp.role_id = p.role_id
     where rp.permission_id = 'payments.verify' and p.status = 'active'`,
  );
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "account",
      title,
      body,
      link: "/admin/payments?status=MANUAL_REVIEW",
    });
  }
}

/**
 * Stores a slip (unique by image hash) and, when SlipOK is configured,
 * verifies it bank-side. Auto-approval is allowed only after:
 *  - SlipOK validates the slip against the bank,
 *  - the receiving account matches the branch registered with SlipOK,
 *  - the amount matches the payment intent exactly,
 *  - the slip has not been used before.
 */
export async function attachSlip(input: {
  reference: string;
  userId: string;
  evidenceUrl: string;
  slipHash: string;
}): Promise<{
  ok: boolean;
  error?: string;
  verified?: boolean;
  credited?: boolean;
  message?: string;
  parsed?: boolean;
  parsedReference?: string;
  parsedBank?: string;
}> {
  const payment = await one<PaymentRow>(
    "select * from payments where reference = $1 and user_id = $2",
    [input.reference, input.userId],
  );
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.status === "PAID") return { ok: false, error: "This payment is already confirmed." };
  if (!["PENDING", "VERIFYING", "MANUAL_REVIEW", "EXPIRED"].includes(payment.status)) {
    return { ok: false, error: "This payment can no longer be submitted." };
  }
  if (input.slipHash) {
    const duplicate = await one<{ reference: string }>(
      "select reference from payments where slip_hash = $1 and id <> $2",
      [input.slipHash, payment.id],
    );
    if (duplicate) {
      return {
        ok: false,
        error: "This slip has already been submitted for another payment. Each transfer can only be used once.",
      };
    }
  }

  // Free self-hosted pre-check: decode the Mini QR printed on the slip and
  // extract the bank + transaction reference. This is NOT a bank confirmation.
  let selfCheck: Record<string, unknown> | null = null;
  let parsedReference: string | undefined;
  let parsedBank: string | undefined;
  let bankRef: string | null = null;
  const upload = await readUploadBytes(input.evidenceUrl);
  if (upload) {
    const qrText = await decodeSlipQr(upload.bytes);
    const parsed = qrText ? parseSlipPayload(qrText) : null;
    if (parsed) {
      parsedReference = slipReference(parsed);
      parsedBank = parsed.kind === "standard" ? parsed.sendingBank : "TrueMoney";
      bankRef = `${parsed.kind}:${parsedReference}`;
      selfCheck = {
        status: "parsed",
        provider: "self",
        kind: parsed.kind,
        reference: parsedReference,
        sendingBank: parsed.kind === "standard" ? parsed.sendingBank : null,
        message:
          parsed.kind === "standard"
            ? "Slip Mini QR parsed. Bank confirmation is still required before credit."
            : "TrueMoney slip QR parsed. Verify the transfer in the TrueMoney app before credit.",
        checkedAt: new Date().toISOString(),
      };
      const duplicateRef = await one<{ reference: string }>(
        "select reference from payments where slip_bank_ref = $1 and id <> $2",
        [bankRef, payment.id],
      );
      if (duplicateRef) {
        return {
          ok: false,
          error: `This slip transfer reference (${parsedReference}) has already been used for payment ${duplicateRef.reference}.`,
        };
      }
    } else {
      selfCheck = {
        status: "invalid",
        provider: "self",
        message: "No valid slip Mini QR found in the image. Manual verification is required.",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  await withTransaction(async (tx) => {
    await tx.query(
      `update payments set evidence_url = $2, slip_hash = $3, slip_bank_ref = $4,
         slip_verification = $5::jsonb, status = 'MANUAL_REVIEW', updated_at = now() where id = $1`,
      [
        payment.id,
        input.evidenceUrl,
        input.slipHash || null,
        bankRef,
        JSON.stringify({ self: selfCheck }),
      ],
    );
  });

  const parsedMessage =
    selfCheck?.status === "parsed"
      ? `Slip QR detected (${parsedBank ?? ""} ${parsedReference ?? ""}). Staff must confirm the transfer with the bank before crediting.`
      : "Slip uploaded. Staff must verify it manually before crediting.";

  const config = await getSlipConfig();
  if (!config.enabled) {
    await notifySlipReviewers(
      payment,
      "Payment slip awaiting review",
      `${payment.reference} - ${Number(payment.amount).toFixed(2)} THB (${parsedMessage})`,
    );
    return {
      ok: true,
      verified: false,
      credited: false,
      parsed: selfCheck?.status === "parsed",
      parsedReference,
      parsedBank,
      message: parsedMessage,
    };
  }

  const result = await verifySlipForPayment(payment.id);
  return {
    ok: true,
    verified: result.status === "verified",
    credited: result.credited,
    parsed: selfCheck?.status === "parsed",
    parsedReference,
    parsedBank,
    message: result.credited
      ? "Slip verified by SlipOK and funds credited automatically."
      : result.message,
  };
}

export interface SlipVerificationOutcome extends SlipOutcome {
  credited: boolean;
  provider: "slipok";
  notConfigured?: boolean;
}

/** Re-run bank-side verification for an existing payment. Safe to call repeatedly. */
export async function verifySlipForPayment(paymentId: string): Promise<SlipVerificationOutcome> {
  const payment = await one<PaymentRow>("select * from payments where id = $1", [paymentId]);
  if (!payment) {
    return { provider: "slipok", status: "error", credited: false, message: "Payment not found." };
  }
  if (!payment.evidence_url) {
    return {
      provider: "slipok",
      status: "error",
      credited: false,
      message: "No slip is attached to this payment.",
    };
  }
  if (payment.status === "PAID") {
    return {
      provider: "slipok",
      status: "verified",
      credited: true,
      message: "This payment has already been confirmed.",
    };
  }

  const result = await verifySlipImage({
    evidenceRef: payment.evidence_url,
    amountMinor: toMinor(payment.amount),
  });
  const previous = (payment.slip_verification ?? {}) as Record<string, unknown>;
  const selfCheck = previous.self ?? null;
  const checked = { ...result, checkedAt: new Date().toISOString(), self: selfCheck };
  await one(
    "update payments set slip_verification = $2::jsonb, updated_at = now() where id = $1 returning id",
    [payment.id, JSON.stringify(checked)],
  );

  const config = await getSlipConfig();
  if (result.status === "verified") {
    if (config.autoApprove) {
      try {
        const settled = await settlePayment({
          paymentId: payment.id,
          source: "slip",
          providerRef: result.transRef ?? null,
          amountMinor: toMinor(payment.amount),
          note: `SlipOK verified ${result.transRef ?? ""}`.trim(),
        });
        const credited = settled.status === "paid" || settled.status === "already_paid";
        await one(
          "update payments set slip_verification = $2::jsonb, updated_at = now() where id = $1 returning id",
          [payment.id, JSON.stringify({ ...checked, credited, settledAt: new Date().toISOString() })],
        );
        return {
          ...result,
          credited,
          message: credited
            ? "Slip verified by SlipOK and funds credited automatically."
            : "Slip verified; the payment was already settled or needs manual review.",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automatic crediting failed.";
        await notifySlipReviewers(payment, "Verified slip needs attention", `${payment.reference}: ${message}`);
        return { ...result, credited: false, message };
      }
    }
    await notifySlipReviewers(
      payment,
      "Slip verified - approval required",
      `${payment.reference}: SlipOK verified this slip. Auto-approval is disabled.`,
    );
    return {
      ...result,
      credited: false,
      message: "Slip verified by SlipOK. Auto-approval is disabled, so staff must approve it.",
    };
  }

  await notifySlipReviewers(
    payment,
    "Slip verification needs review",
    `${payment.reference}: ${result.message}`,
  );
  return { ...result, credited: false };
}

export async function approveManualPayment(input: {
  paymentId: string;
  adminId: string;
  adminEmail: string;
  note?: string;
}): Promise<void> {
  const payment = await one<PaymentRow>("select * from payments where id = $1", [input.paymentId]);
  if (!payment) throw new PaymentConflictError("Payment not found.");
  if (!payment.evidence_url && !payment.voucher_url_encrypted) {
    throw new PaymentConflictError("No payment evidence is attached. Ask the customer for a slip or voucher first.");
  }
  await settlePayment({
    paymentId: payment.id,
    source: "manual",
    reviewerId: input.adminId,
    note: input.note ?? "Manually verified by staff",
  });
  await audit({
    actorId: input.adminId,
    actorEmail: input.adminEmail,
    action: "payment.manual_approve",
    entityType: "payment",
    entityId: payment.id,
    after: { note: input.note ?? null },
  });
}

export async function rejectManualPayment(input: {
  paymentId: string;
  adminId: string;
  note: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const payment = await one<PaymentRow>("select * from payments where id = $1 for update", [input.paymentId], tx);
    if (!payment) throw new PaymentConflictError("Payment not found.");
    if (payment.status === "PAID") throw new PaymentConflictError("A paid payment cannot be rejected.");
    await tx.query(
      `update payments set status = 'REJECTED', reviewer_id = $2, review_note = $3, reviewed_at = now(), updated_at = now()
       where id = $1`,
      [payment.id, input.adminId, input.note]
    );
    if (payment.order_id) {
      const order = await one<{ order_number: string; coupon_id: string | null; status: string }>(
        "select order_number, coupon_id, status from orders where id = $1 for update",
        [payment.order_id],
        tx,
      );
      if (order && order.status === "pending_payment") {
        await tx.query(
          "update orders set status = 'cancelled', payment_status = 'failed', updated_at = now() where id = $1",
          [payment.order_id]
        );
        if (order.coupon_id) {
          await tx.query("update coupons set used_count = greatest(0, used_count - 1) where id = $1", [order.coupon_id],);
          await tx.query("delete from coupon_redemptions where order_id = $1", [payment.order_id],);
        }
      }
    }
    await notify(
      {
        userId: payment.user_id,
        type: "account",
        title: "Payment could not be verified",
        body: `${payment.reference}: ${input.note}`,
        link: `/pay/${payment.reference}`,
      },
      tx,
    );
    await audit(
      {
        actorId: input.adminId,
        action: "payment.manual_reject",
        entityType: "payment",
        entityId: payment.id,
        after: { note: input.note },
      },
      tx,
    );
  });
}

export async function expireStalePayments(): Promise<number> {
  return withTransaction(async (tx) => {
    const stale = await many<PaymentRow>(
      `select * from payments where status in ('PENDING','VERIFYING') and expires_at < now() for update skip locked`,
      [],
      tx,
    );
    for (const payment of stale) {
      await tx.query("update payments set status = 'EXPIRED', updated_at = now() where id = $1", [payment.id],);
      if (payment.order_id) {
        const order = await one<{ status: string; coupon_id: string | null }>(
          "select status, coupon_id from orders where id = $1 for update",
          [payment.order_id],
          tx,
        );
        if (order?.status === "pending_payment") {
          await tx.query(
            "update orders set status = 'cancelled', payment_status = 'failed', updated_at = now() where id = $1",
            [payment.order_id]
          );
          await tx.query(
            "delete from coupon_redemptions where order_id = $1",
            [payment.order_id]
          );
          if (order.coupon_id) {
            await tx.query("update coupons set used_count = greatest(0, used_count - 1) where id = $1", [order.coupon_id],);
          }
        }
      }
    }
    return stale.length;
  });
}

/** Webhook event ingestion with signature verification and replay protection. */
export async function ingestWebhook(input: {
  providerId: string;
  rawBody: string;
  signature: string | null;
  sourceIp: string | null;
}): Promise<{ ok: boolean; httpStatus: number; message: string }> {
  const provider = await one<{
    id: string;
    is_enabled: boolean;
    secret_encrypted: string | null;
    kind: string;
  }>("select id, is_enabled, secret_encrypted, kind from payment_providers where id = $1", [input.providerId]);
  if (!provider) return { ok: false, httpStatus: 404, message: "Unknown provider" };
  if (!provider.is_enabled) return { ok: false, httpStatus: 403, message: "Provider disabled" };

  const allowlist = env.webhookIpAllowlist.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowlist.length > 0 && (!input.sourceIp || !allowlist.includes(input.sourceIp))) {
    return { ok: false, httpStatus: 403, message: "Source IP not allowed" };
  }

  let secret = env.webhookSecret;
  if (provider.secret_encrypted) {
    try {
      secret = decryptSecret(provider.secret_encrypted);
    } catch (error) {
      console.error("[webhook] failed to decrypt provider secret", error);
      return { ok: false, httpStatus: 500, message: "Provider secret misconfigured" };
    }
  }
  if (!secret) return { ok: false, httpStatus: 503, message: "Webhook secret is not configured" };

  const provided = (input.signature ?? "").replace(/^sha256=/i, "").trim();
  const expected = hmacSha256(input.rawBody, secret);
  const valid = provided.length > 0 && safeEqualHex(provided, expected);
  if (!valid) {
    await one(
      `insert into payment_events(provider_id, event_type, payload, signature_valid, ip)
       values ($1, 'invalid_signature', $2::jsonb, false, $3) returning id`,
      [provider.id, JSON.stringify({ length: input.rawBody.length }), input.sourceIp],
    );
    return { ok: false, httpStatus: 401, message: "Invalid signature" };
  }

  let body: {
    reference?: string;
    amount?: string | number;
    provider_ref?: string;
    status?: string;
    event?: string;
  };
  try {
    body = JSON.parse(input.rawBody) as typeof body;
  } catch {
    return { ok: false, httpStatus: 400, message: "Invalid JSON" };
  }
  if (!body.reference) return { ok: false, httpStatus: 400, message: "Missing reference" };
  let amountMinor = 0;
  try {
    amountMinor = toMinor(String(body.amount ?? ""));
  } catch {
    return { ok: false, httpStatus: 400, message: "Invalid amount" };
  }
  if (!amountMinor || amountMinor <= 0) return { ok: false, httpStatus: 400, message: "Invalid amount" };

  const payment = await one<PaymentRow>("select * from payments where reference = $1", [body.reference]);
  const event = await one<{ id: string }>(
    `insert into payment_events(payment_id, provider_id, event_type, provider_ref, payload, signature_valid, ip)
     values ($1,$2,$3,$4,$5::jsonb,true,$6) returning id`,
    [
      payment?.id ?? null,
      provider.id,
      body.event ?? "payment.updated",
      body.provider_ref ?? null,
      input.rawBody,
      input.sourceIp,
    ],
  );
  if (!payment) return { ok: false, httpStatus: 404, message: "Payment not found" };
  if (payment.provider_id !== provider.id) return { ok: false, httpStatus: 409, message: "Provider mismatch" };
  if (!body.provider_ref) return { ok: false, httpStatus: 400, message: "Missing provider_ref" };
  if (body.status !== "PAID") {
    return { ok: true, httpStatus: 200, message: `Ignored status ${body.status ?? "unknown"}` };
  }

  try {
    await settlePayment({
      paymentId: payment.id,
      source: "webhook",
      providerRef: body.provider_ref,
      amountMinor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to settle";
    await one("update payment_events set event_type = $2 where id = $1 returning id", [
      event!.id,
      `error:${message}`.slice(0, 180),
    ]);
    // Duplicate/conflicting events are acknowledged so the provider does not
    // retry forever; they are flagged for manual review instead.
    return { ok: false, httpStatus: 409, message };
  }
  return { ok: true, httpStatus: 200, message: "Payment settled" };
}

export async function syncPaymentStatus(reference: string): Promise<PaymentStatus | null> {
  const payment = await one<PaymentRow>("select * from payments where reference = $1", [reference]);
  if (!payment) return null;
  if (["PENDING", "VERIFYING"].includes(payment.status) && new Date(payment.expires_at) < new Date()) {
    await expireStalePayments();
    return "EXPIRED";
  }
  return payment.status;
}

export function paymentStatusTh(status: PaymentStatus): string {
  switch (status) {
    case "PENDING":
      return "รอชำระเงิน";
    case "VERIFYING":
      return "กำลังตรวจสอบ";
    case "PAID":
      return "ชำระแล้ว";
    case "EXPIRED":
      return "หมดอายุ";
    case "FAILED":
      return "ไม่สำเร็จ";
    case "REJECTED":
      return "ถูกปฏิเสธ";
    case "MANUAL_REVIEW":
      return "รอตรวจสอบสลิป";
    case "REFUNDED":
      return "คืนเงินแล้ว";
  }
}

