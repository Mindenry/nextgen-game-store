import Link from "next/link";
import { ArrowRight, Search, UserCheck, UserX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listCustomers } from "@/lib/admin";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, Card, Input, Pagination, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { setCustomerStatusBoundAction } from "@/actions/admin-content";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.customersView)) return <AccessDenied permission={PERMISSIONS.customersView} />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const result = await listCustomers(q, page);
  const canManage = can(user, PERMISSIONS.customersManage);

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Search accounts, review spending and wallet balances, suspend abusive accounts, and open the full customer record."
      />

      <Card className="mb-4 p-3.5">
        <form method="get" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Email, name or username…" className="pl-8" />
          </div>
          <button type="submit" className={buttonClass({ size: "md" })}>Search</button>
        </form>
      </Card>

      <Card className="p-4">
        <Table className="min-w-[900px]">
          <thead>
            <tr><Th>Customer</Th><Th>Role</Th><Th>Status</Th><Th>Wallet</Th><Th>Orders</Th><Th>Spent</Th><Th>Joined</Th><Th className="text-right">Actions</Th></tr>
          </thead>
          <tbody>
            {result.rows.map((customer) => (
              <tr key={customer.id}>
                <Td>
                  <Link href={`/admin/customers/${customer.id}`} className="text-xs font-semibold text-fg hover:text-primary">
                    {customer.display_name}
                  </Link>
                  <p className="text-[10px] text-muted">{customer.email}</p>
                </Td>
                <Td><Badge tone={customer.role_id === "customer" ? "neutral" : "primary"} className="capitalize">{customer.role_id.replaceAll("_", " ")}</Badge></Td>
                <Td><StatusPill status={customer.status} /></Td>
                <Td className="tabular text-xs">{formatTHB(customer.wallet_balance)}</Td>
                <Td className="text-xs">{customer.order_count}</Td>
                <Td className="tabular text-xs">{formatTHB(customer.total_spent)}</Td>
                <Td className="text-[10px]">{formatDate(customer.created_at)}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={`/admin/customers/${customer.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                      Open <ArrowRight className="size-3" />
                    </Link>
                    {canManage && customer.role_id === "customer" ? (
                      customer.status === "active" ? (
                        <AdminActionButton
                          action={setCustomerStatusBoundAction.bind(null, customer.id, "suspended")}
                          label="Suspend"
                          variant="danger"
                          icon={<UserX className="size-3" />}
                          confirmText={`Suspend ${customer.email}? Active sessions are revoked.`}
                        />
                      ) : (
                        <AdminActionButton
                          action={setCustomerStatusBoundAction.bind(null, customer.id, "active")}
                          label="Activate"
                          variant="success"
                          icon={<UserCheck className="size-3" />}
                        />
                      )
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><Td colSpan={8} className="py-10 text-center text-xs text-muted">No customers found.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>

      <Pagination
        page={result.page}
        pages={Math.max(1, Math.ceil(result.total / result.pageSize))}
        makeHref={(nextPage) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(nextPage) }).toString()}`}
      />
    </div>
  );
}
