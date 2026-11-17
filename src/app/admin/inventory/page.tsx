import { Search } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listInventory } from "@/lib/admin";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, Input, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { RevealPayload } from "@/components/admin/reveal-payload";
import { revealInventoryAction } from "@/actions/admin-catalog";

export const metadata = { title: "Inventory" };

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.inventoryView)) return <AccessDenied permission={PERMISSIONS.inventoryView} />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const items = await listInventory(q);
  const canReveal = can(user, PERMISSIONS.inventoryReveal);

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Inventory"
        description="Every unit is encrypted at rest. Add stock from a product's edit page; sold items retain an immutable delivery record."
        actions={
          canReveal ? <p className="text-[11px] text-warning">Reveal actions are audit logged</p> : null
        }
      />

      <Card className="mb-4 p-3.5">
        <form method="get" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Product, slug or payload hint…" className="pl-8" />
          </div>
          <button type="submit" className={buttonClass({ size: "md" })}>Search</button>
        </form>
      </Card>

      <Card className="p-4">
        <Table className="min-w-[760px]">
          <thead>
            <tr><Th>Hint</Th><Th>Product</Th><Th>Variant</Th><Th>Status</Th><Th>Order</Th><Th>Created</Th><Th>Sold</Th><Th /></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td className="max-w-[160px] truncate font-mono text-[10px]">{item.payload_hint ?? "—"}</Td>
                <Td className="text-xs">{item.product_name}</Td>
                <Td className="text-[10px]">{item.variant_name ?? "Base"}</Td>
                <Td><StatusPill status={item.status} /></Td>
                <Td className="font-mono text-[10px]">{item.order_number ?? "—"}</Td>
                <Td className="text-[10px]">{formatDate(item.created_at)}</Td>
                <Td className="text-[10px]">{item.sold_at ? formatDate(item.sold_at) : "—"}</Td>
                <Td>{canReveal ? <RevealPayload action={revealInventoryAction.bind(null, item.id)} /> : null}</Td>
              </tr>
            ))}
            {items.length === 0 ? <tr><Td colSpan={8} className="py-10 text-center text-xs text-muted">No inventory found.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
