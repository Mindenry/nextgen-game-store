import Link from "next/link";
import { Copy, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listAdminProducts } from "@/lib/admin";
import { formatTHB } from "@/lib/money";
import { Badge, buttonClass, Card, Input, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { deleteProductAction, duplicateProductAction, toggleProductAction } from "@/actions/admin-catalog";

export const metadata = { title: "Products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.productsView)) return <AccessDenied permission={PERMISSIONS.productsView} />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const products = await listAdminProducts(q);
  const canManage = can(user, PERMISSIONS.productsManage);

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Create digital products, manage pricing, stock and delivery. Inventory credentials are encrypted at rest."
        actions={
          canManage ? (
            <Link href="/admin/products/new" className={buttonClass({ size: "sm" })}>
              <Plus className="size-3.5" /> New product
            </Link>
          ) : null
        }
      />

      <Card className="mb-4 p-3.5">
        <form method="get" className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Search by name or slug…" className="pl-8" />
          </div>
          <button type="submit" className={buttonClass({ size: "md" })}>Search</button>
        </form>
      </Card>

      <Card className="p-4">
        <Table className="min-w-[900px]">
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Sold</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 text-[10px] font-bold text-muted">
                      {product.image_url ? (
                         
                        <img src={product.image_url} alt="" className="size-full object-cover" />
                      ) : (
                        product.name_en.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/admin/products/${product.id}`} className="block truncate text-xs font-semibold text-fg hover:text-primary">
                        {product.name_en}
                      </Link>
                      <p className="truncate font-mono text-[9px] text-muted">{product.slug}</p>
                    </div>
                  </div>
                </Td>
                <Td className="text-[11px]">{product.category_name}</Td>
                <Td className="tabular text-xs">{formatTHB(product.price)}</Td>
                <Td className="text-xs">
                  {product.stock_mode === "unlimited" ? "Unlimited" : product.stock_quantity}
                  {product.stock_mode === "inventory" ? <span className="ml-1 text-[9px] text-muted">units</span> : null}
                </Td>
                <Td className="text-[10px] capitalize">{product.product_type.replaceAll("_", " ")}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "Active" : "Hidden"}</Badge>
                    {product.is_featured ? <Badge tone="warning">Featured</Badge> : null}
                  </div>
                </Td>
                <Td className="text-xs">{product.sold_count}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/products/${product.id}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                      <Pencil className="size-3" />
                    </Link>
                    {canManage ? (
                      <>
                        <AdminActionButton action={toggleProductAction.bind(null, product.id, "is_featured")} label="" icon={<Star className="size-3" />} />
                        <AdminActionButton action={duplicateProductAction.bind(null, product.id)} label="" icon={<Copy className="size-3" />} />
                        <AdminActionButton
                          action={toggleProductAction.bind(null, product.id, "is_active")}
                          label={product.is_active ? "Hide" : "Show"}
                        />
                        <AdminActionButton
                          action={deleteProductAction.bind(null, product.id)}
                          label=""
                          icon={<Trash2 className="size-3" />}
                          variant="danger"
                          confirmText={`Delete ${product.name_en}? Products with order history will be deactivated instead.`}
                        />
                      </>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr><Td colSpan={8} className="py-10 text-center text-xs text-muted">No products found.</Td></tr>
            ) : null}
          </tbody>
        </Table>
      </Card>
      <p className="mt-3 text-[11px] text-muted">{products.length} product(s) shown. Total sold and stock update automatically after delivery.</p>
    </div>
  );
}
