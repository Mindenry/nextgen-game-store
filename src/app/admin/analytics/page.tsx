import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { adminStats, analyticsData } from "@/lib/admin";
import { formatTHB, formatNumber } from "@/lib/money";
import { Badge, Card, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { HorizontalBars, RevenueChart, StatusPie } from "@/components/admin/charts";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.analyticsView)) return <AccessDenied permission={PERMISSIONS.analyticsView} />;
  const [stats, data] = await Promise.all([adminStats(), analyticsData()]);

  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    const row = data.series.find((item) => item.day === key);
    return { day: `${date.getDate()}/${date.getMonth() + 1}`, revenue: row ? Number(row.revenue) : 0 };
  });

  const statusData = data.statusBreakdown.map((row) => ({ name: row.status, value: Number(row.count) }));
  const categoryData = data.categoryRevenue.map((row) => ({ name: row.category ?? "Uncategorised", value: Number(row.revenue) }));
  const depositTotal = data.deposits.reduce((sum, row) => sum + Number(row.total), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Sales analytics"
        description="Revenue, order mix, category performance and provider volume — all computed from the live database."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Revenue (30 days)", value: formatTHB(days.reduce((sum, day) => sum + day.revenue, 0)) },
          { label: "Average order value", value: stats.averageOrder },
          { label: "Wallet deposits (30d)", value: formatTHB(depositTotal) },
          { label: "Paid orders", value: formatNumber(stats.paidOrders) },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
            <p className="tabular mt-2 text-lg font-semibold text-fg">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Revenue · 30 days</h2>
          <Badge tone="outline">THB</Badge>
        </div>
        <div className="mt-3">
          <RevenueChart data={days} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Order status mix</h2>
          {statusData.length > 0 ? (
            <>
              <StatusPie data={statusData} />
              <div className="flex flex-wrap gap-2">
                {statusData.map((item) => (
                  <StatusPill key={item.name} status={item.name} />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 text-center text-xs text-muted">No orders yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Revenue by category</h2>
          {categoryData.length > 0 ? (
            <HorizontalBars data={categoryData.slice(0, 8)} />
          ) : (
            <p className="mt-6 text-center text-xs text-muted">No paid order items yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Payment provider volume</h2>
          <div className="mt-3">
            <Table className="min-w-[360px]">
              <thead>
                <tr><Th>Provider</Th><Th className="text-right">Payments</Th><Th className="text-right">Volume</Th></tr>
              </thead>
              <tbody>
                {data.providers.map((provider) => (
                  <tr key={provider.provider_id}>
                    <Td className="text-xs">{provider.provider_id}</Td>
                    <Td className="tabular text-right text-xs">{provider.count}</Td>
                    <Td className="tabular text-right text-xs font-semibold">{formatTHB(provider.total)}</Td>
                  </tr>
                ))}
                {data.providers.length === 0 ? (
                  <tr><Td colSpan={3} className="py-6 text-center text-xs text-muted">No paid payments yet.</Td></tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Wallet deposits · 30 days</h2>
          {data.deposits.length > 0 ? (
            <HorizontalBars
              valueLabel="Deposits (THB)"
              data={data.deposits.slice(-10).map((row) => ({ name: row.day.slice(5), value: Number(row.total) }))}
            />
          ) : (
            <p className="mt-6 text-center text-xs text-muted">No verified deposits in this period.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
