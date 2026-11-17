import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, Clock, CreditCard, Package, ReceiptText, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { one, many } from "@/lib/db";
import { getWallet, walletStats, listWalletTransactions } from "@/lib/wallet";
import { listUserOrders } from "@/lib/orders";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, EmptyState, Stat, StatusPill } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardOverview() {
  const user = await requireUser("/dashboard");
  const [wallet, stats, transactions, orders, counts, notifications, delivered] = await Promise.all([
    getWallet(user.id),
    walletStats(user.id),
    listWalletTransactions(user.id, 5),
    listUserOrders(user.id, 5),
    one<{ total: number; pending: number; completed: number }>(
      `select count(*)::int as total,
              count(*) filter (where status in ('pending_payment','paid','processing'))::int as pending,
              count(*) filter (where status = 'completed')::int as completed
       from orders where user_id = $1`,
      [user.id],
    ),
    many<{ id: string; title: string; body: string | null; created_at: string; link: string | null; read_at: string | null }>(
      "select id, title, body, created_at, link, read_at from notifications where user_id = $1 order by created_at desc limit 3",
      [user.id],
    ),
    one<{ count: number }>(
      `select count(*)::int as count from order_items oi join orders o on o.id = oi.order_id
       where o.user_id = $1 and o.payment_status = 'paid' and oi.fulfillment_status = 'delivered'`,
      [user.id],
    ),
  ]);
  const name = user.displayName.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Welcome back, {name}</h1>
          <p className="mt-1 text-sm text-muted">Here&apos;s what is happening with your account.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/wallet/topup" className={buttonClass({ size: "sm" })}>
            <CreditCard className="size-3.5" /> Add funds
          </Link>
          <Link href="/products" className={buttonClass({ variant: "outline", size: "sm" })}>
            Shop <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {!user.emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm text-warning">
          <p>Verify your email to unlock checkout and secure notifications.</p>
          <Link href="/dashboard/security" className="font-semibold underline">Verify now</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Wallet balance" value={formatTHB(wallet.balance)} icon={<Wallet className="size-4" />} tone="primary" hint={`฿${Number(stats.totalDeposits).toFixed(2)} deposited lifetime`} />
        <Stat label="Total spending" value={formatTHB(stats.totalSpent)} icon={<ReceiptText className="size-4" />} hint="Paid orders and top-ups" />
        <Stat label="Orders" value={counts?.total ?? 0} icon={<Package className="size-4" />} hint={`${counts?.completed ?? 0} completed`} />
        <Stat label="Products owned" value={delivered?.count ?? 0} icon={<CheckCircle2 className="size-4" />} tone="success" hint="Delivered items" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent transactions</h2>
            <Link href="/dashboard/wallet/history" className="text-[11px] font-semibold text-primary hover:underline">View all</Link>
          </div>
          {transactions.length === 0 ? (
            <p className="mt-5 text-sm text-muted">No wallet activity yet. Add funds to get started.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">{tx.description}</p>
                    <p className="text-[10px] text-muted">{formatDate(tx.created_at, true)} · {tx.type}</p>
                  </div>
                  <span className={`tabular shrink-0 text-xs font-semibold ${Number(tx.amount) >= 0 ? "text-success" : "text-fg"}`}>
                    {Number(tx.amount) >= 0 ? "+" : ""}{formatTHB(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/wallet" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
            Manage wallet <ArrowRight className="size-3" />
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-[11px] font-semibold text-primary hover:underline">View all</Link>
          </div>
          {orders.length === 0 ? (
            <div className="mt-5">
              <EmptyState className="!border-0 !py-8" icon={<Package className="size-5" />} title="No orders yet" description="Your purchases will appear here." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/dashboard/orders/${order.order_number}`} className="block truncate font-mono text-xs font-semibold text-fg hover:text-primary">
                      {order.order_number}
                    </Link>
                    <p className="text-[10px] text-muted">
                      {formatDate(order.created_at, true)} · {order.item_count} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={order.status} />
                    <span className="tabular text-xs font-semibold">{formatTHB(order.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Latest notifications</h2>
            <Link href="/dashboard/notifications" className="text-[11px] font-semibold text-primary hover:underline">Open centre</Link>
          </div>
          {notifications.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Bell className="size-4" /> Nothing new right now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notification.link ?? "/dashboard/notifications"}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3 transition hover:border-border-strong"
                  >
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-fg">{notification.title}</p>
                      <p className="truncate text-[11px] text-muted">{notification.body}</p>
                    </div>
                    {!notification.read_at ? <Badge tone="primary" className="text-[9px]">New</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Pending actions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted"><Clock className="size-3.5" /> Pending orders</span>
              <span className="tabular font-semibold text-fg">{counts?.pending ?? 0}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted"><CreditCard className="size-3.5" /> Pending deposits</span>
              <span className="tabular font-semibold text-fg">{stats.pendingDeposits}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted"><Wallet className="size-3.5" /> Wallet</span>
              <Link href="/dashboard/wallet/topup" className="text-[11px] font-semibold text-primary hover:underline">Top up</Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
