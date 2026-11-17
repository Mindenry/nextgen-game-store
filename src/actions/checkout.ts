"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getDetailedCart, clearCart } from "@/lib/cart";
import { createOrderFromCart, CheckoutError, InsufficientStockError } from "@/lib/orders";
import { getLocale } from "@/lib/i18n";
import { rateLimit } from "@/lib/rate-limit";
import { CouponError, calculateCouponDiscount, validateCoupon } from "@/lib/coupons";
import { withTransaction } from "@/lib/db";
import { formatTHB, toMinor } from "@/lib/money";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  couponCode?: string;
  discount?: number;
  total?: number;
};

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  if (!user.emailVerified) {
    return { error: "Please verify your email address before checking out. Open your account → Security to resend the link." };
  }
  const limit = await rateLimit(`checkout:${user.id}`, 10, 300);
  if (!limit.allowed) return { error: "Too many checkout attempts. Please wait a few minutes." };

  if (formData.get("agree") !== "on") return { error: "Please accept the terms and refund policy before ordering." };
  const method = formData.get("method") === "promptpay" ? "promptpay" : "wallet";
  const couponCode = String(formData.get("couponCode") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!idempotencyKey) return { error: "Your checkout session expired. Refresh the page and try again." };

  let result: Awaited<ReturnType<typeof createOrderFromCart>>;
  try {
    result = await createOrderFromCart({
      userId: user.id,
      method,
      couponCode,
      note,
      idempotencyKey,
      locale: await getLocale(),
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) return { error: error.message };
    if (error instanceof CouponError) return { error: error.message, couponCode };
    if (error instanceof CheckoutError) return { error: error.message };
    if (error instanceof Error && error.name === "InsufficientFundsError") {
      return { error: "Your wallet balance is too low for this order. Top up or pay with PromptPay." };
    }
    if (error instanceof Error && error.name === "PromptPayError") return { error: error.message };
    if (error instanceof Error && error.name === "PaymentSetupError") return { error: error.message };
    console.error("[checkout] failed", error);
    return { error: "We could not place your order. No payment was taken. Please try again." };
  }

  await clearCart();
  revalidatePath("/dashboard");
  if (result.paymentReference) redirect(`/pay/${result.paymentReference}`);
  redirect(`/checkout/success/${result.orderNumber}`);
}

export type CouponPreview = {
  error?: string;
  success?: string;
  code?: string;
  discount?: number;
  total?: number;
  subtotal?: number;
};

export async function previewCouponAction(_prev: CouponPreview, formData: FormData): Promise<CouponPreview> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to apply a coupon." };
  const code = String(formData.get("couponCode") ?? "").trim();
  if (!code) return { error: "Enter a coupon code." };
  const limit = await rateLimit(`coupon:${user.id}`, 20, 600);
  if (!limit.allowed) return { error: "Too many attempts. Please wait." };

  const cart = await getDetailedCart(await getLocale());
  if (cart.items.length === 0) return { error: "Your cart is empty." };
  if (cart.hasIssues) return { error: "Fix the issues in your cart first." };

  try {
    const result = await withTransaction(async (tx) => {
      const lines = await Promise.all(
        cart.items.map(async (item) => {
          const row = await tx.query<{ category_id: string }>(
            "select category_id from products where id = $1",
            [item.productId],
          );
          return {
            productId: item.productId,
            categoryId: row[0]?.category_id ?? "",
            lineTotalMinor: item.lineTotalMinor,
          };
        }),
      );
      const validated = await validateCoupon({
        code,
        userId: user.id,
        lines,
        subtotalMinor: cart.subtotalMinor,
        tx,
      });
      const check = calculateCouponDiscount(validated.coupon, lines, cart.subtotalMinor);
      return { discount: check.discountMinor, subtotal: cart.subtotalMinor };
    });
    return {
      success: `Coupon ${code.toUpperCase()} applied.`,
      code: code.toUpperCase(),
      discount: result.discount / 100,
      subtotal: result.subtotal / 100,
      total: (result.subtotal - result.discount) / 100,
    };
  } catch (error) {
    if (error instanceof CouponError) return { error: error.message };
    return { error: "This coupon could not be applied." };
  }
}

export type TopupCheckoutState = { error?: string };

export async function placeTopupOrderAction(
  _prev: TopupCheckoutState,
  formData: FormData,
): Promise<TopupCheckoutState> {
  const gameSlugRaw = String(formData.get("gameSlug") ?? "");
  const user = await requireUser(`/topup/${gameSlugRaw}`);
  if (!user.emailVerified) {
    return { error: "Please verify your email address before ordering." };
  }
  const limit = await rateLimit(`topup:${user.id}`, 10, 300);
  if (!limit.allowed) return { error: "Too many attempts. Please wait a few minutes." };

  const gameSlug = gameSlugRaw;
  const productId = String(formData.get("productId") ?? "");
  if (formData.get("agree") !== "on") return { error: "Please accept the terms and refund policy before ordering." };
  const method = formData.get("method") === "promptpay" ? "promptpay" : "wallet";
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field_")) fields[key.slice(6)] = String(value);
  }

  const { createTopupOrder } = await import("@/lib/orders");
  let redirectTo: string;
  try {
    const result = await createTopupOrder({
      userId: user.id,
      gameSlug,
      productId,
      fields,
      method,
      idempotencyKey,
    });
    redirectTo = result.paymentReference
      ? `/pay/${result.paymentReference}`
      : `/checkout/success/${result.orderNumber}`;
  } catch (error) {
    if (error instanceof Error && ["CheckoutError", "PromptPayError", "PaymentSetupError", "InsufficientFundsError"].includes(error.name)) {
      return { error: error.message };
    }
    console.error("[topup] failed", error);
    return { error: "Could not create the top-up order. No payment was taken." };
  }
  redirect(redirectTo);
}

export async function quotaPreviewAction(amount: number): Promise<string> {
  return formatTHB(toMinor(String(amount)) / 100);
}
