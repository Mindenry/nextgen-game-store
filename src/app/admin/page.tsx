import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  CreditCard,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { adminStats } from "@/lib/admin";
import { formatTHB, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { RevenueChart } from "@/components/admin/charts";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.dashboardView)) return <AccessDenied permission={PERMISSIONS.dashboardView} />;
  const stats = await adminStats();

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    const row = stats.series.find((item) => item.day === key);
    return { day: `${date.getDate()}/${date.getMonth() + 1}`, revenue: row ? Number(row.revenue) : 0 };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={`Good to see you, ${user.displayName.split(" ")[0]}`}
        description="Live figures from the store database — no mock data. Payments and fulfilment update in real time."
        actions={
          <>
            <Link href="/admin/payments" className={buttonClass({ variant: "outline", size: "sm" })}>
              <CreditCard className="size-3.5" /> Review payments
              {stats.pendingPayments > 0 ? <Badge tone="danger" className="ml-1">{stats.pendingPayments}</Badge> : null}
            </Link>
            <Link href="/admin/products" className={buttonClass({ size: "sm" })}>
              <Package className="size-3.5" /> Manage products
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total revenue", value: formatTHB(stats.revenue), hint: `${stats.paidOrders} paid orders`, icon: DollarSign, tone: "text-primary bg-primary/10" },
          { label: "Total orders", value: formatNumber(stats.orders), hint: `${stats.completedOrders} completed`, icon: ShoppingBag, tone: "text-accent bg-accent/10" },
          { label: "Customers", value: formatNumber(stats.customers), hint: "Registered accounts", icon: Users, tone: "text-success bg-success/10" },
          { label: "Wallet deposits", value: formatTHB(stats.deposits), hint: "Verified top-ups", icon: Wallet, tone: "text-warning bg-warning/10" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
              <span className={`grid size-8 place-items-center rounded-lg ${stat.tone}`}>
                <stat.icon className="size-4" />
              </span>
            </div>
            <p className="tabular mt-2.5 text-xl font-semibold text-fg">{stat.value}</p>
            <p className="mt-0.5 text-[10px] text-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Pending payments", value: stats.pendingPayments, href: "/admin/payments?status=MANUAL_REVIEW", toneClass: "text-warning", icon: Clock },
          { label: "Pending orders", value: stats.pendingOrders, href: "/admin/orders", toneClass: "text-primary", icon: Package },
          { label: "Completed orders", value: stats.completedOrders, href: "/admin/orders?status=completed", toneClass: "text-success", icon: BadgeCheck },
          { label: "Failed payments", value: stats.failedPayments, href: "/admin/payments?status=FAILED", toneClass: "text-danger", icon: CreditCard },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="surface-card flex items-center justify-between gap-2 p-3.5 transition hover:border-border-strong">
            <div>
              <p className="text-[10px] text-muted">{item.label}</p>
              <p className="tabular mt-0.5 text-lg font-semibold text-fg">{item.value}</p>
            </div>
            <item.icon className={`size-4 ${item.toneClass}`} />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Revenue · last 14 days</h2>
              <p className="mt-0.5 text-[11px] text-muted">Paid orders, grouped by payment date</p>
            </div>
            <Badge tone="primary" className="flex items-center gap-1"><TrendingUp className="size-3" /> {formatTHB(stats.revenue)} total</Badge>
          </div>
          <div className="mt-3">
            <RevenueChart data={days} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Best selling products</h2>
            <Link href="/admin/products" className="text-[11px] font-semibold text-primary hover:underline">All products</Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {stats.bestSellers.map((product, index) => (
              <li key={product.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-[10px] font-bold text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-fg">{product.name_en}</p>
                  <p className="text-[10px] text-muted">{product.sold_count} sold</p>
                </div>
                <span className="tabular text-xs font-semibold">{formatTHB(product.price)}</span>
              </li>
            ))}
            {stats.bestSellers.length === 0 ? <li className="py-6 text-center text-xs text-muted">No sales yet.</li> : null}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-3">
          <Table className="min-w-[720px]">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Date</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((order) => (
                <tr key={order.id}>
                  <Td>
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-[11px] font-semibold text-fg hover:text-primary">
                      {order.order_number}
                    </Link>
                  </Td>
                  <Td>
                    <p className="text-xs text-fg">{order.display_name}</p>
                    <p className="text-[10px] text-muted">{order.email}</p>
                  </Td>
                  <Td><StatusPill status={order.status} /></Td>
                  <Td><StatusPill status={order.payment_status} /></Td>
                  <Td className="text-[11px]">{formatDate(order.created_at, true)}</Td>
                  <Td className="tabular text-right text-xs font-semibold">{formatTHB(order.total)}</Td>
                </tr>
              ))}
              {stats.recentOrders.length === 0 ? (
                <tr><Td colSpan={6} className="py-8 text-center text-xs text-muted">No orders yet.</Td></tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
