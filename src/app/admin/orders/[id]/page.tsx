import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, Package, RotateCcw } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getAdminOrder } from "@/lib/admin";
import { getFileUrl } from "@/lib/uploads";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, Separator, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import {
  manualDeliveryAction,
  refundOrderAction,
  saveOrderNoteAction,
  updateOrderStatusAction,
} from "@/actions/admin-orders";

export const metadata = { title: "Order detail" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.ordersView)) return <AccessDenied permission={PERMISSIONS.ordersView} />;
  const { id } = await params;
  const data = await getAdminOrder(id);
  if (!data) notFound();
  const canManage = can(user, PERMISSIONS.ordersManage);
  const canRefund = can(user, PERMISSIONS.ordersRefund);
  const evidenceUrls = await Promise.all(
    data.payments.map(async (payment) => ({ reference: payment.reference, url: payment.evidence_url ? await getFileUrl(payment.evidence_url) : null })),
  );

  return (
    <div>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Orders
      </Link>
      <PageHeader
        eyebrow="Order"
        title={data.order.order_number}
        description={`${data.order.display_name} · ${data.order.email} · placed ${formatDate(data.order.created_at, true)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={data.order.status} />
            <StatusPill status={data.order.payment_status} />
            <StatusPill status={data.order.delivery_status} />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Items &amp; fulfilment</h2>
            <div className="mt-4 space-y-5">
              {data.items.map((item) => {
                const topup = data.topups.find((row) => row.order_item_id === item.id);
                return (
                  <div key={item.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-fg">{item.product_name}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {item.quantity} × {formatTHB(item.unit_price)} · {item.delivery_method} · {item.product_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={item.fulfillment_status} />
                        {topup ? <StatusPill status={topup.status} /> : null}
                        <span className="tabular text-xs font-semibold">{formatTHB(item.total)}</span>
                      </div>
                    </div>

                    {item.topup_fields ? (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-[10px] text-muted">
                        {JSON.stringify(item.topup_fields, null, 2)}
                      </pre>
                    ) : null}
                    {item.delivery_note ? <p className="mt-2 text-[11px] text-muted">Note: {item.delivery_note}</p> : null}
                    {topup ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="outline">Top-up: {topup.game_name} — {topup.package_name}</Badge>
                        <Link href="/admin/topup" className={buttonClass({ variant: "ghost", size: "sm" })}>
                          Process in Top-Up queue
                        </Link>
                      </div>
                    ) : null}

                    {canManage && item.fulfillment_status !== "delivered" && item.product_type !== "topup" ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[11px] font-semibold text-primary">Deliver this item manually</summary>
                        <div className="mt-3 rounded-xl bg-surface-2/60 p-3">
                          <AdminActionForm action={manualDeliveryAction} submitLabel="Save & mark delivered">
                            <input type="hidden" name="orderItemId" value={item.id} />
                            <input type="hidden" name="complete" value="on" />
                            <label className="mb-1.5 block text-[11px] font-semibold text-fg-soft">Delivery payload (JSON, encrypted at rest)</label>
                            <textarea
                              name="payload"
                              rows={4}
                              placeholder='{"username":"...","password":"...","notes":"..."}'
                              className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs"
                            />
                            <label className="mb-1.5 mt-2 block text-[11px] font-semibold text-fg-soft">Delivery note</label>
                            <input
                              name="deliveryNote"
                              placeholder="e.g. Login details delivered"
                              className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs"
                            />
                          </AdminActionForm>
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Payments</h2>
            <div className="mt-3">
              <Table className="min-w-[560px]">
                <thead>
                  <tr><Th>Reference</Th><Th>Provider</Th><Th>Status</Th><Th>Created</Th><Th className="text-right">Amount</Th><Th>Evidence</Th></tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => {
                    const evidence = evidenceUrls.find((row) => row.reference === payment.reference)?.url;
                    return (
                      <tr key={payment.id}>
                        <Td>
                          <Link href={`/admin/payments?q=${payment.reference}`} className="font-mono text-[10px] text-primary hover:underline">
                            {payment.reference}
                          </Link>
                        </Td>
                        <Td className="text-[11px]">{payment.provider_id}</Td>
                        <Td><StatusPill status={payment.status} /></Td>
                        <Td className="text-[10px]">{formatDate(payment.created_at, true)}</Td>
                        <Td className="tabular text-right text-xs font-semibold">{formatTHB(payment.amount)}</Td>
                        <Td className="text-[10px]">
                          {evidence ? (
                            <a href={evidence} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">View slip</a>
                          ) : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                  {data.payments.length === 0 ? (
                    <tr><Td colSpan={6} className="py-6 text-center text-xs text-muted">No payments for this order.</Td></tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Audit trail</h2>
            <ul className="mt-3 space-y-2">
              {data.audits.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-[11px]">
                  <span className="font-medium text-fg-soft">{entry.action}</span>
                  <span className="text-right text-muted">
                    {entry.actor_email ?? "system"} · {formatDate(entry.created_at, true)}
                  </span>
                </li>
              ))}
              {data.audits.length === 0 ? <li className="text-xs text-muted">No audit entries yet.</li> : null}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Summary</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular">{formatTHB(data.order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular">{formatTHB(data.order.discount_total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Coupon</dt><dd>{data.order.coupon_code ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Method</dt><dd className="capitalize">{data.order.payment_method ?? "—"}</dd></div>
              <Separator className="my-1" />
              <div className="flex justify-between"><dt className="font-semibold">Total</dt><dd className="tabular font-semibold">{formatTHB(data.order.total)}</dd></div>
            </dl>
            {data.order.customer_note ? (
              <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[11px]">
                <p className="font-semibold text-fg">Customer note</p>
                <p className="mt-1 whitespace-pre-line text-muted">{data.order.customer_note}</p>
              </div>
            ) : null}
          </Card>

          {canManage ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Update order</h2>
              <div className="mt-3">
                <AdminActionForm action={updateOrderStatusAction} submitLabel="Update status" compact>
                  <input type="hidden" name="orderId" value={data.order.id} />
                  <label className="mb-1.5 block text-[11px] font-semibold text-fg-soft">New status</label>
                  <select name="status" defaultValue="processing" className="focus-ring h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs">
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled (unpaid only)</option>
                  </select>
                </AdminActionForm>
              </div>
              <Separator className="my-4" />
              <AdminActionForm action={saveOrderNoteAction} submitLabel="Save note" compact>
                <input type="hidden" name="orderId" value={data.order.id} />
                <textarea
                  name="internalNote"
                  rows={3}
                  defaultValue={data.order.internal_note ?? ""}
                  placeholder="Internal note (staff only)"
                  className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs"
                />
              </AdminActionForm>
            </Card>
          ) : null}

          {canRefund && data.order.payment_status === "paid" ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="size-4 text-danger" /> Refund order</h2>
              <p className="mt-1 text-[11px] text-muted">
                The full amount is credited to the customer&apos;s wallet and the order becomes refunded. Delivered
                credentials are not recoverable.
              </p>
              <div className="mt-3">
                <AdminActionForm action={refundOrderAction} submitLabel="Refund to wallet" submitVariant="danger" compact>
                  <input type="hidden" name="orderId" value={data.order.id} />
                  <input
                    name="reason"
                    required
                    minLength={5}
                    placeholder="Reason (required)"
                    className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs"
                  />
                </AdminActionForm>
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-primary" /> Customer</h2>
            <p className="mt-2 text-xs font-medium text-fg">{data.order.display_name}</p>
            <p className="text-[11px] text-muted">{data.order.email}</p>
            <Link href={`/admin/customers/${data.order.user_id}`} className={buttonClass({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
              Open customer profile
            </Link>
          </Card>

          <Card className="p-5 text-[11px] text-muted">
            <p className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> Payments are verified server-side.</p>
            <p className="mt-2">Internal notes and audit entries are visible to staff only.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
