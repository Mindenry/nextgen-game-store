"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { placeTopupOrderAction, type TopupCheckoutState } from "@/actions/checkout";
import { formatMinorTHB, toMinor } from "@/lib/money";
import { Alert, Button, Field, Input, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

type GameField = {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  pattern?: string;
};

type Package = {
  id: string;
  name: string;
  price: string;
  compare_at_price: string | null;
  delivery_type: string;
};

export function TopupForm({
  gameSlug,
  fields,
  packages,
  walletBalanceMinor,
  promptPayAvailable,
  idempotencyKey,
  locale,
}: {
  gameSlug: string;
  fields: GameField[];
  packages: Package[];
  walletBalanceMinor: number;
  promptPayAvailable: boolean;
  idempotencyKey: string;
  locale: "th" | "en";
}) {
  const [state, action, pending] = useActionState<TopupCheckoutState, FormData>(placeTopupOrderAction, {});
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [method, setMethod] = useState<"wallet" | "promptpay">("wallet");
  const selected = useMemo(() => packages.find((p) => p.id === packageId), [packages, packageId]);
  const priceMinor = selected ? toMinor(selected.price) : 0;
  const insufficient = method === "wallet" && priceMinor > walletBalanceMinor;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <form action={action} className="space-y-5">
        <input type="hidden" name="gameSlug" value={gameSlug} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="productId" value={packageId} />
        <input type="hidden" name="method" value={method} />

        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{locale === "th" ? "1. ข้อมูลผู้เล่น" : "1. Player details"}</h2>
            <ShieldCheck className="size-4 text-success" />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {locale === "th" ? "ตรวจสอบให้ตรงกับบัญชีเกมของคุณ" : "Make sure these match your game account exactly."}
          </p>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={`field_${field.key}`}
                required={field.required !== false}
                hint={field.help}
                className={field.key.toLowerCase().includes("id") ? "" : ""}
              >
                <Input
                  id={`field_${field.key}`}
                  name={`field_${field.key}`}
                  placeholder={field.placeholder}
                  required={field.required !== false}
                  pattern={field.pattern}
                  autoComplete="off"
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-semibold">{locale === "th" ? "2. เลือกแพ็กเกจ" : "2. Choose a package"}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {packages.map((pack) => {
              const active = pack.id === packageId;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackageId(pack.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition",
                    active ? "border-primary bg-primary/6 ring-1 ring-primary/15" : "border-border hover:border-border-strong",
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold text-fg">{pack.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {pack.delivery_type === "auto" ? "Automatic" : "Processed by staff"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-semibold text-fg">{formatMinorTHB(toMinor(pack.price))}</span>
                    {pack.compare_at_price && toMinor(pack.compare_at_price) > toMinor(pack.price) ? (
                      <span className="tabular text-[10px] text-muted line-through">{formatMinorTHB(toMinor(pack.compare_at_price))}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-semibold">{locale === "th" ? "3. ชำระเงิน" : "3. Payment"}</h2>
          <div className="mt-3 space-y-2">
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5", method === "wallet" ? "border-primary bg-primary/6" : "border-border")}>
              <input type="radio" name="paymentChoice" checked={method === "wallet"} onChange={() => setMethod("wallet")} className="mt-0.5 accent-[var(--primary)]" />
              <Wallet className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="flex items-center justify-between text-sm font-semibold">
                  {locale === "th" ? "Wallet" : "Wallet"}
                  <span className="tabular text-xs text-muted">{formatMinorTHB(walletBalanceMinor)}</span>
                </span>
                <span className="block text-[11px] text-muted">{locale === "th" ? "ตัดยอดทันที" : "Debited instantly"}</span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5",
                method === "promptpay" ? "border-primary bg-primary/6" : "border-border",
                !promptPayAvailable && "cursor-not-allowed opacity-60",
              )}
            >
              <input type="radio" name="paymentChoice" checked={method === "promptpay"} onChange={() => setMethod("promptpay")} disabled={!promptPayAvailable} className="mt-0.5 accent-[var(--primary)]" />
              <QrCode className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="text-sm font-semibold">PromptPay QR</span>
                <span className="block text-[11px] text-muted">
                  {promptPayAvailable
                    ? locale === "th" ? "ต้องรอการยืนยันก่อนดำเนินการ" : "Payment must be verified first"
                    : locale === "th" ? "ยังไม่ได้ตั้งค่า PromptPay" : "PromptPay is not configured"}
                </span>
              </span>
            </label>
          </div>

          {insufficient ? (
            <Alert variant="warning" className="mt-3">
              {locale === "th" ? "ยอด Wallet ไม่เพียงพอ กรุณาเติมเงินหรือเลือก PromptPay" : "Not enough wallet balance. Top up or use PromptPay."}
            </Alert>
          ) : null}
          {state.error ? <Alert variant="danger" className="mt-3">{state.error}</Alert> : null}

          <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <input type="checkbox" name="agree" required className="mt-0.5 accent-[var(--primary)]" />
            <span>
              {locale === "th"
                ? "??????????????????????????????????????????"
                : "I accept the terms and refund policy."}
            </span>
          </label>
          <Button type="submit" size="lg" className="mt-3 w-full" disabled={pending || !packageId || insufficient}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : method === "wallet" ? <Wallet className="size-4" /> : <QrCode className="size-4" />}
            {pending
              ? locale === "th" ? "กำลังดำเนินการ…" : "Processing…"
              : `${locale === "th" ? "ยืนยันการเติม" : "Confirm top-up"} · ${formatMinorTHB(priceMinor)}`}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted">
            {locale === "th"
              ? "ราคาและแพ็กเกจถูกตรวจสอบฝั่งเซิร์ฟเวอร์"
              : "Prices and packages are verified server-side."}
          </p>
        </section>
      </form>

      <aside className="surface-card sticky top-24 p-5">
        <h3 className="text-sm font-semibold">{locale === "th" ? "สรุปคำสั่งซื้อ" : "Order summary"}</h3>
        <div className="mt-3 space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted">{locale === "th" ? "แพ็กเกจ" : "Package"}</span>
            <span className="text-right font-medium text-fg">{selected?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">{locale === "th" ? "ชำระ" : "Payment"}</span>
            <span className="capitalize text-fg">{method}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">{locale === "th" ? "สถานะ" : "Delivery"}</span>
            <Badge tone="warning">{locale === "th" ? "รอดำเนินการ" : "Processing"}</Badge>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">{locale === "th" ? "รวม" : "Total"}</span>
            <span className="tabular text-xl font-semibold">{formatMinorTHB(priceMinor)}</span>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <Check className="size-3.5 text-success" /> How fulfilment works
          </p>
          <p className="mt-1">
            {locale === "th"
              ? "ทีมงานจะตรวจสอบ UID/Server และดำเนินการเติม จากนั้นอัปเดตสถานะในคำสั่งซื้อของคุณ"
              : "Our team verifies your UID/server, processes the top-up and updates the order status."}
          </p>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[10px] text-muted">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {locale === "th"
            ? "ไม่สามารถแก้ไข UID ได้หลังชำระเงินแล้ว"
            : "Player details cannot be changed after payment."}
        </p>
      </aside>
    </div>
  );
}
