import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getCustomerDetail } from "@/lib/admin";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, Input, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { adjustWalletAction } from "@/actions/admin-finance";
import { setCustomerStatusBoundAction } from "@/actions/admin-content";

export const metadata = { title: "Customer" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.customersView)) return <AccessDenied permission={PERMISSIONS.customersView} />;
  const { id } = await params;
  const data = await getCustomerDetail(id);
  if (!data) notFound();
  const canAdjust = can(user, PERMISSIONS.walletAdjust);
  const canManage = can(user, PERMISSIONS.customersManage);

  return (
    <div>
      <Link href="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Customers
      </Link>
      <PageHeader
        eyebrow="Customer record"
        title={data.customer.display_name}
        description={`${data.customer.email} · joined ${formatDate(data.customer.created_at)} · last login ${data.customer.last_login_at ? formatDate(data.customer.last_login_at, true) : "never"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={data.customer.status} />
            <Badge tone={data.customer.email_verified_at ? "success" : "warning"}>
              {data.customer.email_verified_at ? "Email verified" : "Email unverified"}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted">Wallet balance</p>
              <p className="tabular mt-1 text-lg font-semibold">{formatTHB(data.customer.balance)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted">Orders</p>
              <p className="tabular mt-1 text-lg font-semibold">{data.orders.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted">Payments</p>
              <p className="tabular mt-1 text-lg font-semibold">{data.payments.length}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Table className="mt-3 min-w-[520px]">
              <thead><tr><Th>Order</Th><Th>Status</Th><Th>Date</Th><Th className="text-right">Total</Th><Th /></tr></thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <Td className="font-mono text-[10px]">{order.order_number}</Td>
                    <Td><StatusPill status={order.status} /></Td>
                    <Td className="text-[10px]">{formatDate(order.created_at, true)}</Td>
                    <Td className="tabular text-right text-xs">{formatTHB(order.total)}</Td>
                    <Td>
                      <Link href={`/admin/orders/${order.id}`} className="text-[10px] font-semibold text-primary">Open</Link>
                    </Td>
                  </tr>
                ))}
                {data.orders.length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-xs text-muted">No orders.</Td></tr> : null}
              </tbody>
            </Table>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Wallet ledger</h2>
            <Table className="mt-3 min-w-[620px]">
              <thead><tr><Th>Type</Th><Th>Description</Th><Th>Date</Th><Th className="text-right">Amount</Th><Th className="text-right">Balance</Th></tr></thead>
              <tbody>
                {data.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="text-[10px] capitalize">{entry.type.replaceAll("_", " ")}</Td>
                    <Td className="text-[11px]">{entry.description}</Td>
                    <Td className="text-[10px]">{formatDate(entry.created_at, true)}</Td>
                    <Td className={`tabular text-right text-xs ${Number(entry.amount) >= 0 ? "text-success" : ""}`}>
                      {Number(entry.amount) >= 0 ? "+" : ""}{formatTHB(entry.amount)}
                    </Td>
                    <Td className="tabular text-right text-[10px]">{formatTHB(entry.balance_after)}</Td>
                  </tr>
                ))}
                {data.ledger.length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-xs text-muted">No ledger entries.</Td></tr> : null}
              </tbody>
            </Table>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Payments</h2>
            <Table className="mt-3 min-w-[560px]">
              <thead><tr><Th>Reference</Th><Th>Purpose</Th><Th>Status</Th><Th>Date</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.reference}>
                    <Td>
                      <Link href={`/pay/${payment.reference}`} className="font-mono text-[10px] text-primary hover:underline">{payment.reference}</Link>
                    </Td>
                    <Td className="text-[10px] capitalize">{payment.purpose.replace("_", " ")}</Td>
                    <Td><StatusPill status={payment.status} /></Td>
                    <Td className="text-[10px]">{formatDate(payment.created_at, true)}</Td>
                    <Td className="tabular text-right text-xs">{formatTHB(payment.amount)}</Td>
                  </tr>
                ))}
                {data.payments.length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-xs text-muted">No payments.</Td></tr> : null}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          {canAdjust ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-primary" /> Adjust wallet</h2>
              <p className="mt-1 text-[11px] text-muted">Every adjustment creates a ledger entry with your staff ID and the reason.</p>
              <div className="mt-3">
                <AdminActionForm action={adjustWalletAction} submitLabel="Apply adjustment" compact>
                  <input type="hidden" name="userId" value={data.customer.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <select name="direction" className="focus-ring h-9 rounded-xl border border-border bg-surface px-2 text-xs">
                      <option value="credit">Credit (+)</option>
                      <option value="debit">Debit (−)</option>
                    </select>
                    <Input name="amount" required type="number" step="0.01" min="0.01" placeholder="Amount" className="!h-9 !text-xs" />
                  </div>
                  <Input name="reason" required minLength={5} placeholder="Reason (required)" className="mt-2 !h-9 !text-xs" />
                </AdminActionForm>
              </div>
            </Card>
          ) : null}

          {canManage && data.customer.role_id === "customer" ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Account status</h2>
              <p className="mt-1 text-[11px] text-muted">Suspending revokes all active sessions immediately.</p>
              <div className="mt-3">
                {data.customer.status === "active" ? (
                  <AdminActionButton
                    action={setCustomerStatusBoundAction.bind(null, data.customer.id, "suspended")}
                    label="Suspend account"
                    variant="danger"
                    confirmText="Suspend this customer and revoke their sessions?"
                  />
                ) : (
                  <AdminActionButton
                    action={setCustomerStatusBoundAction.bind(null, data.customer.id, "active")}
                    label="Reactivate account"
                    variant="success"
                  />
                )}
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Support tickets</h2>
            <ul className="mt-2 space-y-1.5">
              {data.tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link href={`/admin/support/${ticket.id}`} className="block rounded-lg border border-border p-2 text-[11px] hover:border-border-strong">
                    <span className="font-medium text-fg">{ticket.subject}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[9px] text-muted">
                      {ticket.ticket_number} <StatusPill status={ticket.status} />
                    </span>
                  </Link>
                </li>
              ))}
              {data.tickets.length === 0 ? <li className="text-[11px] text-muted">No tickets.</li> : null}
            </ul>
          </Card>

          <Card className="p-5 text-[11px] text-muted">
            <p>Passwords can never be viewed or changed by staff. Customers reset them through the secure email flow.</p>
            <Link href="/admin/audit" className={buttonClass({ variant: "ghost", size: "sm", className: "mt-2 !px-0" })}>
              Review audit logs
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
