import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, MessageSquare, Package, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderByNumber } from "@/lib/orders";
import { many } from "@/lib/db";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, buttonClass, Card, Separator, StatusPill } from "@/components/ui";
import { ProductImage } from "@/components/product-card";
import { ReviewForm } from "@/components/review-form";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUser(`/dashboard/orders/${orderNumber}`);
  const data = await getOrderByNumber(orderNumber);
  if (!data || data.order.user_id !== user.id) notFound();

  const reviews =
    data.items.length > 0
      ? await many<{ order_item_id: string; status: string }>(
          "select order_item_id, status from reviews where order_item_id = any($1::uuid[])",
          [data.items.map((item) => item.id)],
        )
      : [];
  const reviewedIds = new Set(reviews.map((review) => review.order_item_id));
  const topupByItem = new Map(data.topups.map((topup) => [topup.order_item_id, topup]));
  const pending = data.order.status === "pending_payment";
  const failed = ["cancelled", "refunded"].includes(data.order.status);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> My orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Order</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{data.order.order_number}</h1>
          <p className="mt-1 text-sm text-muted">Placed {formatDate(data.order.created_at, true)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={data.order.status} />
          <StatusPill status={data.order.payment_status} />
        </div>
      </div>

      {pending && data.payment ? (
        <Alert variant="warning" title="Payment is still pending">
          <p>This order will be processed once payment is confirmed.</p>
          <Link href={`/pay/${data.payment.reference}`} className={buttonClass({ size: "sm", className: "mt-2" })}>
            <CreditCard className="size-3.5" /> Complete payment
          </Link>
        </Alert>
      ) : null}
      {failed ? (
        <Alert variant="danger" title={`This order is ${data.order.status}`}>
          <p>{data.order.status === "refunded" ? "The amount was returned to your wallet." : "No payment was taken or the order was cancelled."}</p>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Items</h2>
            <div className="mt-3 divide-y divide-border">
              {data.items.map((item, index) => {
                const topup = topupByItem.get(item.id);
                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex gap-3">
                      <ProductImage imageUrl={item.image_url} name={item.product_name} icon="Gamepad2" index={index} className="size-16 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-fg">{item.product_name}</p>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {item.quantity} × {formatTHB(item.unit_price)} · {item.delivery_method} delivery
                            </p>
                          </div>
                          <p className="tabular text-sm font-semibold">{formatTHB(item.total)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusPill status={item.fulfillment_status} />
                          {topup ? <StatusPill status={topup.status} /> : null}
                          {item.delivery_note ? <span className="text-[10px] text-muted">{item.delivery_note}</span> : null}
                        </div>
                        {topup?.player_fields ? (
                          <div className="mt-2 rounded-lg bg-surface-2 p-2.5 font-mono text-[10px] text-muted">
                            {Object.entries(topup.player_fields).map(([key, value]) => (
                              <span key={key} className="mr-3">{key}: <span className="text-fg">{value}</span></span>
                            ))}
                          </div>
                        ) : null}
                        {topup?.failure_reason ? (
                          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-danger">
                            <XCircle className="mt-px size-3.5 shrink-0" /> {topup.failure_reason}
                          </p>
                        ) : null}
                        {item.fulfillment_status === "delivered" && item.product_type !== "topup" ? (
                          <Link href="/dashboard/products" className="mt-2 inline-block text-[11px] font-semibold text-primary hover:underline">
                            Open delivered product →
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    {item.fulfillment_status === "delivered" && item.product_id ? (
                      reviewedIds.has(item.id) ? (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-success">
                          <CheckCircle2 className="size-3.5" /> Review submitted
                        </p>
                      ) : (
                        <ReviewForm orderItemId={item.id} />
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          {data.order.customer_note ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-primary" /> Your note</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted">{data.order.customer_note}</p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Summary</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular">{formatTHB(data.order.subtotal)}</dd></div>
              {Number(data.order.discount_total) > 0 ? (
                <div className="flex justify-between text-success"><dt>Discount {data.order.coupon_code ? `(${data.order.coupon_code})` : ""}</dt><dd className="tabular">-{formatTHB(data.order.discount_total)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>Free</dd></div>
              <Separator className="my-1" />
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="tabular text-lg font-semibold">{formatTHB(data.order.total)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] text-muted">
              <p>Payment method: <span className="font-medium capitalize text-fg">{data.order.payment_method ?? "—"}</span></p>
              {data.payment ? (
                <p className="mt-1">Reference: <span className="font-mono text-fg">{data.payment.reference}</span></p>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-3 text-xs">
              <li className="flex gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Package className="size-3" /></span>
                <div><p className="font-semibold text-fg">Order created</p><p className="text-[10px] text-muted">{formatDate(data.order.created_at, true)}</p></div>
              </li>
              <li className="flex gap-2.5">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${data.order.paid_at ? "bg-success/10 text-success" : "bg-surface-2 text-muted"}`}><CreditCard className="size-3" /></span>
                <div><p className="font-semibold text-fg">Payment</p><p className="text-[10px] text-muted">{data.order.paid_at ? formatDate(data.order.paid_at, true) : "Pending"}</p></div>
              </li>
              <li className="flex gap-2.5">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${data.order.delivery_status === "delivered" ? "bg-success/10 text-success" : "bg-surface-2 text-muted"}`}>
                  {data.order.delivery_status === "delivered" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                </span>
                <div><p className="font-semibold text-fg">Delivery</p><p className="text-[10px] capitalize text-muted">{data.order.delivery_status}</p></div>
              </li>
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Need help?</h2>
            <p className="mt-1 text-xs text-muted">Our support team can check this order with you.</p>
            <Link href="/dashboard/support" className={buttonClass({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
              Open a ticket
            </Link>
            <p className="mt-2 text-center text-[10px] text-muted">
              <Badge tone="neutral">Order ID: {data.order.order_number}</Badge>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
