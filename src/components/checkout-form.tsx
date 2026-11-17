"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Check, CreditCard, Loader2, LockKeyhole, QrCode, Tag, Wallet } from "lucide-react";
import { placeOrderAction, previewCouponAction, type CheckoutState, type CouponPreview } from "@/actions/checkout";
import { Alert, Button, Field, Input } from "@/components/ui";
import { formatMinorTHB } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CheckoutForm({
  subtotalMinor,
  walletBalanceMinor,
  promptPayAvailable,
  idempotencyKey,
  locale,
  itemCount,
  disabled,
}: {
  subtotalMinor: number;
  walletBalanceMinor: number;
  promptPayAvailable: boolean;
  idempotencyKey: string;
  locale: "th" | "en";
  itemCount: number;
  disabled?: boolean;
}) {
  const [order, orderAction, ordering] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const [coupon, couponAction, checkingCoupon] = useActionState<CouponPreview, FormData>(previewCouponAction, {});
  const [method, setMethod] = useState<"wallet" | "promptpay">("wallet");

  const discountMinor = coupon.code ? Math.round((coupon.discount ?? 0) * 100) : 0;
  const totalMinor = Math.max(0, subtotalMinor - discountMinor);
  const insufficient = method === "wallet" && totalMinor > walletBalanceMinor;

  return (
    <div className="space-y-5">
      <form action={couponAction} className="surface-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Tag className="size-4 text-primary" /> {locale === "th" ? "โค้ดส่วนลด" : "Coupon code"}
        </h3>
        <div className="mt-3 flex gap-2">
          <Input
            name="couponCode"
            defaultValue={coupon.code ?? ""}
            placeholder="NEXTGEN10"
            className="uppercase"
            aria-label="Coupon code"
          />
          <Button type="submit" variant="secondary" disabled={checkingCoupon}>
            {checkingCoupon ? <Loader2 className="size-4 animate-spin" /> : null}
            {locale === "th" ? "ใช้โค้ด" : "Apply"}
          </Button>
        </div>
        {coupon.error ? <p className="mt-2 text-xs font-medium text-danger">{coupon.error}</p> : null}
        {coupon.success && coupon.code ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" /> {coupon.code} — save {formatMinorTHB(discountMinor)}
          </p>
        ) : null}
      </form>

      <form action={orderAction} className="space-y-5">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="couponCode" value={coupon.code ?? ""} />
        <input type="hidden" name="method" value={method} />

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold">{locale === "th" ? "ช่องทางชำระเงิน" : "Payment method"}</h3>
          <div className="mt-3 space-y-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                method === "wallet" ? "border-primary bg-primary/6 ring-1 ring-primary/15" : "border-border hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="methodChoice"
                checked={method === "wallet"}
                onChange={() => setMethod("wallet")}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <Wallet className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {locale === "th" ? "จ่ายด้วย Wallet" : "Pay with wallet"}
                  <span className="tabular text-xs font-medium text-muted">{formatMinorTHB(walletBalanceMinor)}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {locale === "th" ? "ตัดยอดทันทีและส่งสินค้าอัตโนมัติ" : "Instant debit, immediate delivery"}
                </span>
              </span>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                method === "promptpay" ? "border-primary bg-primary/6 ring-1 ring-primary/15" : "border-border hover:border-border-strong",
                !promptPayAvailable && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="methodChoice"
                checked={method === "promptpay"}
                onChange={() => setMethod("promptpay")}
                disabled={!promptPayAvailable}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <QrCode className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="text-sm font-semibold">PromptPay QR</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {promptPayAvailable
                    ? locale === "th"
                      ? "สแกนจ่ายและรอตรวจสอบ ระบบจะไม่ขึ้นว่าสำเร็จจนกว่าจะยืนยัน"
                      : "Scan and wait for verification. Never marked paid without confirmation."
                    : locale === "th"
                      ? "ยังไม่ได้ตั้งค่า PromptPay — ตั้งค่าได้ที่ Admin → Settings"
                      : "PromptPay is not configured yet — set it in Admin → Settings."}
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold">{locale === "th" ? "หมายเหตุถึงร้าน" : "Note to the store"} <span className="font-normal text-muted">(optional)</span></h3>
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            placeholder={locale === "th" ? "เช่น ข้อมูลเพิ่มเติมสำหรับการจัดส่ง" : "e.g. anything we should know about delivery"}
            className="focus-ring mt-2 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted/70"
          />
        </section>

        <section className="surface-card p-5">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>{locale === "th" ? "สินค้า" : "Items"} ({itemCount})</span>
              <span className="tabular text-fg">{formatMinorTHB(subtotalMinor)}</span>
            </div>
            {discountMinor > 0 ? (
              <div className="flex justify-between text-success">
                <span>{locale === "th" ? "ส่วนลด" : "Discount"}</span>
                <span className="tabular">-{formatMinorTHB(discountMinor)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-muted">
              <span>{locale === "th" ? "ค่าธรรมเนียม" : "Fees"}</span>
              <span>{locale === "th" ? "ฟรี" : "Free"}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-semibold text-fg">{locale === "th" ? "ยอดที่ต้องชำระ" : "Total due"}</span>
              <span className="tabular text-2xl font-semibold text-fg">{formatMinorTHB(totalMinor)}</span>
            </div>
          </div>

          {insufficient ? (
            <Alert variant="warning" className="mt-4" title={locale === "th" ? "ยอดเงินไม่เพียงพอ" : "Insufficient balance"}>
              <p>
                {locale === "th" ? "เติมเงินเข้ากระเป๋า หรือเลือกชำระด้วย PromptPay" : "Top up your wallet or choose PromptPay instead."}
              </p>
              <Link href="/dashboard/wallet/topup" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <CreditCard className="size-3.5" /> {locale === "th" ? "เติมเงินเข้ากระเป๋า" : "Top up wallet"}
              </Link>
            </Alert>
          ) : null}

          {order.error ? (
            <Alert variant="danger" className="mt-4">
              <span className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {order.error}
              </span>
            </Alert>
          ) : null}

          <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <input type="checkbox" name="agree" required className="mt-0.5 accent-[var(--primary)]" />
            <span>
              {locale === "th"
                ? "ฉันยอมรับข้อกำหนดการใช้งานและนโยบายคืนเงิน สินค้าดิจิทัลไม่สามารถคืนได้หลังส่งมอบ"
                : "I accept the terms and refund policy. Delivered digital goods are non-refundable."}
            </span>
          </label>

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            disabled={ordering || disabled || (method === "wallet" && insufficient)}
          >
            {ordering ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
            {ordering
              ? locale === "th"
                ? "กำลังดำเนินการ…"
                : "Processing…"
              : locale === "th"
                ? "ยืนยันคำสั่งซื้อ"
                : "Place order securely"}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted">
            {locale === "th" ? "ราคาและสต็อกถูกตรวจสอบฝั่งเซิร์ฟเวอร์อีกครั้ง" : "Price and stock are re-verified server-side."}
          </p>
        </section>
      </form>
    </div>
  );
}
