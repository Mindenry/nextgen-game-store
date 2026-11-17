import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderByNumber } from "@/lib/orders";
import { getLocale } from "@/lib/i18n";
import { formatTHB } from "@/lib/money";
import { buttonClass, StatusPill } from "@/components/ui";

export const metadata = { title: "Order confirmed" };

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUser(`/checkout/success/${orderNumber}`);
  const data = await getOrderByNumber(orderNumber);
  if (!data) notFound();
  if (data.order.user_id !== user.id) notFound();
  if (data.order.payment_status !== "paid") redirect(`/dashboard/orders/${orderNumber}`);
  const locale = await getLocale();

  return (
    <div className="container-page max-w-3xl py-12">
      <div className="surface-card p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/10 text-success">
          <CheckCircle2 className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">
          {locale === "th" ? "คำสั่งซื้อของคุณพร้อมแล้ว" : "Your order is in"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {data.order.payment_status === "paid"
            ? locale === "th"
              ? "การชำระเงินได้รับการยืนยันแล้ว สินค้าจะแสดงใน My Products"
              : "Payment confirmed. Your items are available in My Products."
            : locale === "th"
              ? "เรากำลังรอการยืนยันการชำระเงิน"
              : "We are waiting for payment confirmation."}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs">
          <span className="font-mono font-semibold text-fg">{data.order.order_number}</span>
          <StatusPill status={data.order.payment_status} />
        </div>
      </div>

      <div className="surface-card mt-5 p-5">
        <h2 className="text-sm font-semibold">{locale === "th" ? "รายการสินค้า" : "Order items"}</h2>
        <div className="mt-3 divide-y divide-border">
          {data.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{item.product_name}</p>
                <p className="text-[11px] text-muted">
                  {item.quantity} × {formatTHB(item.unit_price)} · {item.delivery_method}
                </p>
              </div>
              <p className="tabular text-sm font-semibold">{formatTHB(item.total)}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">{locale === "th" ? "ยอดชำระ" : "Total paid"}</span>
          <span className="tabular text-lg font-semibold">{formatTHB(data.order.total)}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link href="/dashboard/products" className={buttonClass({ className: "flex-1" })}>
          <Package className="size-4" /> {locale === "th" ? "ดูสินค้าของฉัน" : "Open my products"}
        </Link>
        <Link href="/products" className={buttonClass({ variant: "outline", className: "flex-1" })}>
          {locale === "th" ? "เลือกซื้อต่อ" : "Keep shopping"} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
