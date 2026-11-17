"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { createDeposit, attachSlip, PaymentSetupError } from "@/lib/payments";
import { getPromptPayConfig } from "@/lib/settings";
import { depositSchema, firstError } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { saveUpload, UploadError } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";
import { createHash } from "node:crypto";
import { getLocale } from "@/lib/i18n";

export type DepositState = { error?: string };

export async function createDepositAction(_prev: DepositState, formData: FormData): Promise<DepositState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/wallet/topup");
  if (!user.emailVerified) return { error: "Verify your email address before adding funds." };
  const limit = await rateLimit(`deposit:${user.id}`, 10, 600);
  if (!limit.allowed) return { error: "Too many deposit attempts. Please wait a few minutes." };

  const parsed = depositSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const amountMinor = toMinor(parsed.data.amount.toFixed(2));
  const providerId = String(formData.get("providerId") ?? "") || undefined;

  let reference: string;
  try {
    const payment = await createDeposit({ userId: user.id, amountMinor, providerId });
    reference = payment.reference;
  } catch (error) {
    if (error instanceof PaymentSetupError) return { error: error.message };
    if (error instanceof Error && error.name === "PromptPayError") return { error: error.message };
    console.error("[deposit] failed", error);
    return { error: "Could not create the payment. Please try again." };
  }
  redirect(`/pay/${reference}`);
}

export type SlipState = { error?: string; success?: string };

const SLIP_ERRORS_TH: Array<[RegExp, string]> = [
  [/already been submitted for another payment/i, "สลิปนี้ถูกใช้กับรายการอื่นไปแล้ว — สลิป 1 ใบใช้ได้ครั้งเดียว กรุณาแนบสลิปของรายการนี้"],
  [/transfer reference .* already been used/i, "เลขอ้างอิงในสลิปนี้ถูกใช้ไปแล้ว กรุณาแนบสลิปของการโอนครั้งใหม่"],
  [/already confirmed/i, "รายการนี้ชำระเงินเรียบร้อยแล้ว"],
  [/can no longer be submitted/i, "รายการนี้ส่งสลิปไม่ได้แล้ว (อาจหมดอายุหรือถูกปิด)"],
  [/payment not found/i, "ไม่พบรายการชำระเงินนี้"],
  [/too many uploads/i, "อัปโหลดบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
  [/sign in first/i, "กรุณาเข้าสู่ระบบก่อน"],
  [/choose a (slip )?file|choose a file/i, "กรุณาเลือกรูปสลิป"],
  [/5 MB/i, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB"],
  [/only jpg|not a valid image|valid image/i, "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP"],
  [/test auto-credit could not be applied/i, "โหมดทดลองเติมเงินอัตโนมัติไม่สำเร็จ สลิปถูกส่งให้เจ้าหน้าที่ตรวจแทน"],
];

function localizeSlipError(message: string, th: boolean): string {
  if (!th) return message;
  for (const [pattern, text] of SLIP_ERRORS_TH) {
    if (pattern.test(message)) return text;
  }
  return message;
}

export async function uploadSlipAction(_prev: SlipState, formData: FormData): Promise<SlipState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const reference = String(formData.get("reference") ?? "");
  const locale = await getLocale();
  const th = locale === "th";
  const file = formData.get("slip");
  if (!(file instanceof File) || file.size === 0) {
    return { error: th ? "กรุณาเลือกรูปสลิปก่อนกดส่ง" : "Choose a slip image." };
  }
  if (/\.hei[cf]$/i.test(file.name) || ["image/heic", "image/heif"].includes(file.type)) {
    return {
      error: th
        ? "ไฟล์ HEIC จาก iPhone ยังไม่รองรับ — แปลงเป็น JPG/PNG หรือแคปหน้าจอก่อนแนบ"
        : "HEIC images are not supported yet. Convert the file to JPG or PNG first.",
    };
  }
  const limit = await rateLimit(`slip:${user.id}`, 8, 600);
  if (!limit.allowed) {
    return { error: th ? "อัปโหลดบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" : "Too many uploads. Please wait." };
  }

  let attached = false;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const slipHash = createHash("sha256").update(bytes).digest("hex");
    const url = await saveUpload({ file, folder: "slips", ownerId: user.id });
    const result = await attachSlip({ reference, userId: user.id, evidenceUrl: url, slipHash });
    if (!result.ok) {
      return { error: localizeSlipError(result.error ?? "Could not attach the slip.", th) };
    }
    revalidatePath(`/pay/${reference}`);
    attached = true;
  } catch (error) {
    if (error instanceof UploadError) return { error: localizeSlipError(error.message, th) };
    console.error("[slip] upload failed", error);
    return {
      error: th ? "อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" : "Upload failed. Please try again.",
    };
  }
  // Redirect outside the try/catch: `redirect()` throws, and catching it would
  // turn a successful upload into a fake error. Landing back at the top also
  // guarantees the customer sees the updated payment status.
  if (attached) redirect(`/pay/${reference}?uploaded=1`);
  return { error: th ? "แนบสลิปไม่สำเร็จ" : "The slip could not be attached." };
}

export async function getDepositLimitsAction(): Promise<{ min: number; max: number }> {
  await requireUser();
  const config = await getPromptPayConfig();
  return { min: config.minDeposit, max: config.maxDeposit };
}
