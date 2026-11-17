import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Download,
  Info,
  Landmark,
  QrCode,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { one } from "@/lib/db";
import { getPaymentByReference, qrDataUrl, syncPaymentStatus, type PaymentStatus } from "@/lib/payments";
import { getEnabledProvider, getSettings } from "@/lib/settings";
import { getFileUrl } from "@/lib/uploads";
import { env } from "@/lib/env";
import { formatTHB } from "@/lib/money";
import { Alert, buttonClass, Card, Separator, StatusPill } from "@/components/ui";
import { CopyButton, PaymentStatusWatcher } from "@/components/pay-client";
import { SlipUploader } from "@/components/slip-uploader";
import { TruemoneyVoucherForm } from "@/components/truemoney-voucher-form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Payment" };

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await requireUser(`/pay/${reference}`);
  const payment = await getPaymentByReference(reference);
  if (!payment) notFound();
  const isOwner = payment.user_id === user.id;
  if (!isOwner && !can(user, PERMISSIONS.paymentsView)) notFound();

  const status = (await syncPaymentStatus(reference)) ?? payment.status;
  const [provider, order, evidenceUrl, settings] = await Promise.all([
    getEnabledProvider(payment.provider_id),
    payment.order_id
      ? one<{ order_number: string; status: string }>("select order_number, status from orders where id = $1", [
          payment.order_id,
        ])
      : Promise.resolve(null),
    payment.evidence_url ? getFileUrl(payment.evidence_url) : Promise.resolve(null),
    getSettings(),
  ]);
  const truemoneyPhone = String(settings["truemoney.phone"] ?? "0812345678");

  const qr = payment.qr_payload ? await qrDataUrl(payment.qr_payload) : null;
  const autoVerify =
    (provider?.kind === "webhook" || provider?.kind === "promptpay" || provider?.kind === "bank") &&
    Boolean(env.webhookSecret || provider?.secret_encrypted);
  const testCredit = payment.verification_source === "self_test";
  const demoAutoCredit =
    payment.purpose === "wallet_deposit" &&
    Number(payment.amount) <= 1 &&
    env.nodeEnv !== "production" &&
    settings["slip.self_auto_credit"] === true;
  const pending = ["PENDING", "VERIFYING", "MANUAL_REVIEW"].includes(status);
  const failed = ["EXPIRED", "REJECTED", "FAILED", "REFUNDED"].includes(status);

  if (status === "PAID" && payment.purpose === "wallet_deposit" && isOwner) {
    // Keep the receipt on screen; the wallet link below is the next action.
  }

  return (
    <div className="container-page max-w-4xl py-8 md:py-12">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          {payment.purpose === "wallet_deposit" ? "Wallet top-up" : "Order payment"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
          {status === "PAID" ? "Payment confirmed" : failed ? "Payment not completed" : "Complete your payment"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Reference <span className="font-mono font-semibold text-fg">{payment.reference}</span>
          {order ? (
            <>
              {" · "}
              <Link href={`/dashboard/orders/${order.order_number}`} className="text-primary hover:underline">
                {order.order_number}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-4">
          {status === "PAID" ? (
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success">
                  <BadgeCheck className="size-6" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">{testCredit ? "Test credit applied" : "Payment verified"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {testCredit
                      ? `${formatTHB(payment.amount)} demo credit was added from a structural QR pre-check. This is NOT a bank confirmation.`
                      : `${formatTHB(payment.amount)} was confirmed${payment.paid_at ? ` on ${formatDate(payment.paid_at, true)}` : ""}.`}
                    {!testCredit && payment.purpose === "wallet_deposit"
                      ? " The amount is now in your wallet."
                      : !testCredit
                        ? " Your order is now being delivered."
                        : ""}
                  </p>
                  {testCredit ? (
                    <p className="mt-2 rounded-lg border border-warning/30 bg-warning/8 p-2 text-[10px] font-medium text-warning">
                      DEMO/TEST mode: only enabled for ≤฿1 in development. Add SlipOK or verify the bank statement for real money.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-md border border-border bg-surface-2 px-2 py-1">
                      Verification: {payment.verification_source ?? "manual"}
                    </span>
                    <span className="rounded-md border border-border bg-surface-2 px-2 py-1">
                      Provider: {provider?.name ?? payment.provider_id}
                    </span>
                  </div>
                </div>
              </div>
              <Separator className="my-5" />
              <div className="flex flex-col gap-2 sm:flex-row">
                {payment.purpose === "wallet_deposit" ? (
                  <>
                    <Link href="/dashboard/wallet" className={buttonClass({ className: "flex-1" })}>
                      <Wallet className="size-4" /> View wallet
                    </Link>
                    <Link href="/products" className={buttonClass({ variant: "outline", className: "flex-1" })}>
                      Continue shopping <ArrowRight className="size-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard/products" className={buttonClass({ className: "flex-1" })}>
                      Open my products
                    </Link>
                    <Link href="/dashboard/orders" className={buttonClass({ variant: "outline", className: "flex-1" })}>
                      View order
                    </Link>
                  </>
                )}
              </div>
            </Card>
          ) : failed ? (
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
                <div>
                  <h2 className="text-lg font-semibold">
                    {status === "EXPIRED" ? "This payment has expired" : "This payment was not completed"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {status === "REJECTED"
                      ? "Staff could not verify the payment. Contact support if you believe this is wrong."
                      : status === "REFUNDED"
                        ? "This payment has been refunded."
                        : "No funds were credited. Create a new payment to try again."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={payment.purpose === "wallet_deposit" ? "/dashboard/wallet/topup" : "/cart"} className={buttonClass({ size: "sm" })}>
                      Try again
                    </Link>
                    <Link href="/dashboard/support" className={buttonClass({ variant: "outline", size: "sm" })}>
                      Contact support
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="grid gap-6 p-6 sm:grid-cols-[220px_1fr]">
                <div>
                  {qr ? (
                    <div className="rounded-2xl border border-border bg-white p-3">
                      { }
                      <img src={qr} alt={`PromptPay QR for ${payment.reference}`} className="w-full rounded-lg" />
                    </div>
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-border bg-surface-2 text-muted">
                      <div className="text-center">
                        <Landmark className="mx-auto size-8" />
                        <p className="mt-2 text-xs">Bank transfer</p>
                      </div>
                    </div>
                  )}
                  {qr ? (
                    <a
                      href={qr}
                      download={`nextgen-${payment.reference}.png`}
                      className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted hover:text-fg"
                    >
                      <Download className="size-3.5" /> Save QR image
                    </a>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <QrCode className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">
                      {autoVerify ? "Scan to pay" : "Scan, then submit your slip"}
                    </h2>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {provider?.name ?? payment.provider_id} · {autoVerify ? "Automatic verification" : "Manual verification"}
                  </p>

                  <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Amount due</p>
                    <p className="tabular mt-0.5 text-2xl font-semibold text-fg">{formatTHB(payment.amount)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[11px] text-muted">{payment.reference}</p>
                      <CopyButton value={payment.reference} label="Copy" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <PaymentStatusWatcher
                      reference={payment.reference}
                      initialStatus={status}
                      expiresAt={payment.expires_at}
                    />
                  </div>

                  {!autoVerify ? (
                    <Alert variant="warning" className="mt-3">
                      <div className="flex gap-2">
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        <p>
                          {demoAutoCredit
                            ? "DEMO/test mode: wallet top-ups up to ฿1 are credited automatically when the slip Mini QR passes the structural check. This is not a bank confirmation — real amounts still need SlipOK/KBank or manual review."
                            : "Automatic webhook verification is not connected for this provider. Upload your payment slip and staff will verify it before any funds are credited. The status will never show as paid without confirmation."}
                        </p>
                      </div>
                    </Alert>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                      <Clock className="size-3.5" /> This page refreshes automatically after the provider confirms payment.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border bg-surface-2/40 p-6">
                {provider?.id === "truemoney_angpao" ? (
                  <>
                    <h3 className="text-sm font-semibold">TrueMoney Angpao</h3>
                    <p className="mt-1 text-[11px] text-muted">
                      ส่งซองอั่งเปามาที่เบอร์ {truemoneyPhone} แล้ววางลิงก์ซอง เจ้าหน้าที่จะ redeem และอนุมัติยอดให้
                    </p>
                    {payment.voucher_hash ? (
                      <p className="mt-3 rounded-lg border border-border bg-surface p-2.5 text-[11px] text-fg-soft">
                        ส่งลิงก์ซองแล้ว — รอเจ้าหน้าที่เปิดซองและอนุมัติ
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <TruemoneyVoucherForm reference={payment.reference} phone={truemoneyPhone} />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold">Already paid? Submit your evidence</h3>
                    <p className="mt-1 text-[11px] text-muted">
                      Slips are stored privately. Only you and authorised finance staff can view them.
                    </p>
                    {evidenceUrl ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                        <p className="text-xs text-fg-soft">Slip attached — awaiting review</p>
                        <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline">
                          View
                        </a>
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <SlipUploader reference={payment.reference} />
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted">
                      {demoAutoCredit
                        ? "DEMO mode: a slip with a structurally valid Mini QR is credited instantly for amounts up to ฿1. Real amounts are reviewed by finance staff against the bank statement."
                        : "Uploading a slip does not credit your wallet automatically. Finance staff verify the amount, account and reference against the bank statement."}
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          {provider?.kind === "manual" && pending ? (
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Transfer details</h3>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                {String(provider.config.instructions ?? "Contact support for bank transfer details.")}
              </pre>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Payment summary</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd><StatusPill status={status as PaymentStatus} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Purpose</dt>
                <dd className="font-medium capitalize text-fg">{payment.purpose.replace("_", " ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Amount</dt>
                <dd className="tabular font-semibold text-fg">{formatTHB(payment.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Created</dt>
                <dd className="text-fg">{formatDate(payment.created_at, true)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Expires</dt>
                <dd className="text-fg">{formatDate(payment.expires_at, true)}</dd>
              </div>
            </dl>
            <Separator className="my-4" />
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Every payment has a unique reference. Never reuse or change the amount — mismatched amounts are rejected.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Need help?</h3>
            <p className="mt-1 text-xs text-muted">Open a ticket with your reference and our team will check the payment.</p>
            <Link href="/dashboard/support" className={buttonClass({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
              Contact support
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
