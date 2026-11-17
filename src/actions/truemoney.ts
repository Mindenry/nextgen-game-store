"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { encryptSecret, sha256 } from "@/lib/crypto";
import { many, one, run } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { parseTruemoneyVoucher } from "@/lib/truemoney";

export type TruemoneyState = { error?: string; success?: string };

/**
 * Records a TrueMoney Angpao voucher for staff redemption. It never redeems the
 * voucher automatically and never credits the wallet; staff must redeem it in
 * the TrueMoney app first, then approve the payment (existing finance flow).
 */
export async function submitTruemoneyVoucherAction(
  _prev: TruemoneyState,
  formData: FormData,
): Promise<TruemoneyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const reference = String(formData.get("reference") ?? "");
  const voucherInput = String(formData.get("voucher") ?? "");
  const limit = await rateLimit(`truemoney:${user.id}`, 8, 600);
  if (!limit.allowed) return { error: "Too many submissions. Please wait a few minutes." };

  const voucher = parseTruemoneyVoucher(voucherInput);
  if (!voucher) {
    return {
      error: "ลิงก์ซองอั่งเปาไม่ถูกต้อง ต้องเป็นลิงก์จาก gift.truemoney.com หรือรหัสซองที่ถูกต้อง",
    };
  }
  const payment = await one<{ id: string; provider_id: string; status: string; amount: string }>(
    "select id, provider_id, status, amount from payments where reference = $1 and user_id = $2",
    [reference, user.id],
  );
  if (!payment) return { error: "Payment not found." };
  if (payment.provider_id !== "truemoney_angpao") {
    return { error: "This payment is not a TrueMoney Angpao payment." };
  }
  if (payment.status === "PAID") return { error: "This payment is already confirmed." };
  if (!["PENDING", "VERIFYING", "MANUAL_REVIEW", "EXPIRED"].includes(payment.status)) {
    return { error: "This payment can no longer be submitted." };
  }

  const voucherHash = sha256(voucher.code);
  const duplicate = await one<{ reference: string }>(
    "select reference from payments where voucher_hash = $1 and id <> $2",
    [voucherHash, payment.id],
  );
  if (duplicate) {
    return { error: "ซองอั่งเปานี้ถูกใช้กับรายการอื่นแล้ว กรุณาใช้ซองใหม่" };
  }

  const encrypted = encryptSecret(
    JSON.stringify({ input: voucher.url ?? voucher.code, code: voucher.code }),
  );
  await run(
    `update payments set voucher_hash = $2, voucher_url_encrypted = $3, status = 'MANUAL_REVIEW',
       review_note = 'TrueMoney Angpao voucher submitted - redeem before approval', updated_at = now()
     where id = $1`,
    [payment.id, voucherHash, encrypted],
  );

  const admins = await many<{ id: string }>(
    `select p.id from profiles p join role_permissions rp on rp.role_id = p.role_id
     where rp.permission_id = 'payments.verify' and p.status = 'active'`,
  );
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "account",
      title: "TrueMoney Angpao awaiting redemption",
      body: `${reference} - ${Number(payment.amount).toFixed(2)} THB. Redeem the voucher in TrueMoney, then approve.`,
      link: "/admin/payments?status=MANUAL_REVIEW",
    });
  }

  revalidatePath(`/pay/${reference}`);
  return {
    success:
      "ได้รับลิงก์ซองอั่งเปาแล้ว เจ้าหน้าที่จะเปิดซองไปที่เบอร์ที่ร้านตั้งไว้ และอนุมัติยอดให้หลังตรวจสอบ",
  };
}
