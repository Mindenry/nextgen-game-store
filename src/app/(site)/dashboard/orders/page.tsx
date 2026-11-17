import Link from "next/link";
import { ArrowRight, Package, ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listUserOrders } from "@/lib/orders";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, EmptyState, StatusPill, Table, Td, Th } from "@/components/ui";
import { ProductImage } from "@/components/product-card";

export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("/dashboard/orders");
  const orders = await listUserOrders(user.id, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Orders</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">My orders &amp; purchases</h1>
          <p className="mt-1 text-sm text-muted">Track payments, delivery and download your products.</p>
        </div>
        <Link href="/products" className={buttonClass({ size: "sm", variant: "outline" })}>
          Continue shopping <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-5" />}
          title="No orders yet"
          description="When you buy something it will appear here with its delivery status."
          action={<Link href="/products" className={buttonClass({ size: "sm" })}>Browse products</Link>}
        />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {orders.map((order, index) => (
              <Link key={order.id} href={`/dashboard/orders/${order.order_number}`} className="surface-card block p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold">{order.order_number}</span>
                  <StatusPill status={order.status} />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProductImage imageUrl={order.first_image} name={order.order_number} icon="Package" index={index} className="size-12 rounded-lg" />
                  <div className="flex-1">
                    <p className="text-[11px] text-muted">{order.item_count} items · {formatDate(order.created_at, true)}</p>
                    <p className="tabular text-sm font-semibold">{formatTHB(order.total)}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>

          <Card className="hidden p-5 lg:block">
            <Table className="min-w-[760px]">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Items</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Total</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link href={`/dashboard/orders/${order.order_number}`} className="font-mono text-xs font-semibold text-fg hover:text-primary">
                        {order.order_number}
                      </Link>
                    </Td>
                    <Td className="text-xs">{order.item_count}</Td>
                    <Td><StatusPill status={order.status} /></Td>
                    <Td><StatusPill status={order.payment_status} /></Td>
                    <Td className="text-[11px]">{formatDate(order.created_at, true)}</Td>
                    <Td className="tabular text-right text-xs font-semibold">{formatTHB(order.total)}</Td>
                    <Td className="text-right">
                      <Link href={`/dashboard/orders/${order.order_number}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        View <ArrowRight className="size-3" />
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted">
            <Package className="size-3.5" />
            Delivered products are available in{" "}
            <Link href="/dashboard/products" className="font-semibold text-primary hover:underline">My Products</Link>.
          </div>
        </>
      )}
    </div>
  );
}
