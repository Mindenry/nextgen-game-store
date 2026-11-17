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

export async function uploadSlipAction(_prev: SlipState, formData: FormData): Promise<SlipState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const reference = String(formData.get("reference") ?? "");
  const file = formData.get("slip");
  if (!(file instanceof File)) return { error: "Choose a slip image." };
  const limit = await rateLimit(`slip:${user.id}`, 8, 600);
  if (!limit.allowed) return { error: "Too many uploads. Please wait." };

  try {
    const url = await saveUpload({ file, folder: "slips", ownerId: user.id });
    const result = await attachSlip({ reference, userId: user.id, evidenceUrl: url });
    if (!result.ok) return { error: result.error ?? "Could not attach the slip." };
    revalidatePath(`/pay/${reference}`);
    return { success: "Slip uploaded. Staff will verify your payment before funds are credited." };
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message };
    console.error("[slip] upload failed", error);
    return { error: "Upload failed. Please try again." };
  }
}

export async function getDepositLimitsAction(): Promise<{ min: number; max: number }> {
  await requireUser();
  const config = await getPromptPayConfig();
  return { min: config.minDeposit, max: config.maxDeposit };
}
