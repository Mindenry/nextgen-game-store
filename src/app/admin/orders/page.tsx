import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listAdminOrders } from "@/lib/admin";
import { formatTHB } from "@/lib/money";
import { formatDate, cn } from "@/lib/utils";
import { buttonClass, Card, Input, Pagination, Select, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";

export const metadata = { title: "Orders" };

const STATUSES = ["", "pending_payment", "paid", "processing", "completed", "cancelled", "refunded"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.ordersView)) return <AccessDenied permission={PERMISSIONS.ordersView} />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const result = await listAdminOrders({ q, status: status || undefined, page, pageSize: 20 });

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Search, inspect and fulfil orders. Every status change and refund is audit logged."
        actions={<p className="text-xs text-muted">{result.total} order(s)</p>}
      />

      <Card className="mb-4 p-3.5">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Order number, email or customer…" className="pl-8" />
          </div>
          <Select name="status" defaultValue={status} className="w-auto">
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option ? option.replaceAll("_", " ") : "All statuses"}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClass({ size: "md" })}>Filter</button>
          <Link href="/admin/orders" className={cn(buttonClass({ variant: "ghost", size: "md" }))}>Reset</Link>
        </form>
      </Card>

      <Card className="p-4">
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Items</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th>Delivery</Th>
              <Th>Created</Th>
              <Th className="text-right">Total</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {result.rows.map((order) => (
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
                <Td className="text-xs">{order.item_count}</Td>
                <Td><StatusPill status={order.status} /></Td>
                <Td><StatusPill status={order.payment_status} /></Td>
                <Td><StatusPill status={order.delivery_status} /></Td>
                <Td className="text-[10px]">{formatDate(order.created_at, true)}</Td>
                <Td className="tabular text-right text-xs font-semibold">{formatTHB(order.total)}</Td>
                <Td className="text-right">
                  <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                    Open <ArrowRight className="size-3" />
                  </Link>
                </Td>
              </tr>
            ))}
            {result.rows.length === 0 ? (
              <tr><Td colSpan={9} className="py-10 text-center text-xs text-muted">No orders match this filter.</Td></tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      <Pagination
        page={result.page}
        pages={Math.max(1, Math.ceil(result.total / result.pageSize))}
        makeHref={(nextPage) => `/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(nextPage) }).toString()}`}
      />
    </div>
  );
}
