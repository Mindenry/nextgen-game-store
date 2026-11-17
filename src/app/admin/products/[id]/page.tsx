import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getAdminProduct } from "@/lib/admin";
import { getCategories } from "@/lib/catalog";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { ProductEditor } from "@/components/admin/product-editor";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { RevealPayload } from "@/components/admin/reveal-payload";
import {
  addInventoryAction,
  deleteVariantAction,
  addProductImageAction,
  deleteInventoryAction,
  deleteProductImageAction,
  revealInventoryAction,
  saveVariantAction,
} from "@/actions/admin-catalog";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.productsView)) return <AccessDenied permission={PERMISSIONS.productsView} />;
  const { id } = await params;
  const data = await getAdminProduct(id);
  if (!data) notFound();
  const categories = await getCategories(false);
  const canManage = can(user, PERMISSIONS.productsManage);
  const canInventory = can(user, PERMISSIONS.inventoryManage);
  const canReveal = can(user, PERMISSIONS.inventoryReveal);

  const variants = data.variants as unknown as {
    id: string;
    name_en: string;
    name_th: string;
    price: string;
    compare_at_price: string | null;
    stock_quantity: number;
    is_active: boolean;
    sort_order: number;
  }[];

  return (
    <div>
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Products
      </Link>
      <PageHeader
        eyebrow="Catalogue"
        title={String(data.product.name_en)}
        description={`Slug: ${String(data.product.slug)} · created ${formatDate(String(data.product.created_at))}`}
        actions={
          <Link href={`/products/${String(data.product.slug)}`} className={buttonClass({ variant: "outline", size: "sm" })}>
            View in store
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Product details</h2>
          {canManage ? (
            <ProductEditor product={data.product} categories={categories.map((category) => ({ id: category.id, name_en: category.name_en }))} />
          ) : (
            <p className="text-xs text-muted">Your role can view but not edit products.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Images</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {data.images.map((image) => (
                <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                  { }
                  <img src={image.url} alt={image.alt ?? ""} className="size-full object-cover" />
                  {canManage ? (
                    <div className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
                      <AdminActionButton
                        action={deleteProductImageAction.bind(null, image.id, id)}
                        label=""
                        icon={<Trash2 className="size-3" />}
                        variant="danger"
                        confirmText="Delete this image?"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
              {data.images.length === 0 ? <p className="col-span-3 text-[11px] text-muted">No images yet.</p> : null}
            </div>
            {canManage ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Add image</summary>
                <div className="mt-2">
                  <AdminActionForm action={addProductImageAction} submitLabel="Add image" compact>
                    <input type="hidden" name="productId" value={id} />
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="w-full text-[11px]" />
                    <input name="imageUrl" placeholder="…or paste an image URL" className="focus-ring mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                    <input name="alt" placeholder="Alt text" className="focus-ring mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                  </AdminActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Variants</h2>
            <div className="mt-2 space-y-2">
              {variants.map((variant) => (
                <div key={variant.id} className="rounded-xl border border-border p-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-fg">{variant.name_en}</p>
                    <StatusPill status={variant.is_active ? "AVAILABLE" : "DISABLED"} />
                  </div>
                  <p className="mt-0.5 text-muted">
                    {Number(variant.price).toFixed(2)} THB · stock {variant.stock_quantity}
                  </p>
                </div>
              ))}
              {variants.length === 0 ? <p className="text-[11px] text-muted">No variants — the base price is used.</p> : null}
            </div>
            {canManage ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Add variant</summary>
                <div className="mt-2">
                  <AdminActionForm action={saveVariantAction} submitLabel="Add variant" compact>
                    <input type="hidden" name="productId" value={id} />
                    <div className="grid gap-2">
                      <input name="nameEn" required placeholder="Name (EN)" className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                      <input name="nameTh" required placeholder="Name (TH)" className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                      <input name="price" required type="number" step="0.01" placeholder="Price THB" className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                      <input name="compareAtPrice" type="number" step="0.01" placeholder="Compare-at (optional)" className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                      <input name="stockQuantity" type="number" min="0" defaultValue="0" placeholder="Stock" className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs" />
                      <label className="flex items-center gap-2 text-[11px] text-fg-soft">
                        <input type="checkbox" name="isActive" defaultChecked className="accent-[var(--primary)]" /> Active
                      </label>
                    </div>
                  </AdminActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Encrypted inventory</h2>
            <p className="mt-1 text-[10px] text-muted">Payloads are encrypted with AES-256-GCM. List view never shows credentials.</p>
            {canInventory ? (
              <div className="mt-3">
                <AdminActionForm action={addInventoryAction} submitLabel="Encrypt & add inventory" compact>
                  <input type="hidden" name="productId" value={id} />
                  {variants.length > 0 ? (
                    <select name="variantId" className="focus-ring mb-2 h-9 w-full rounded-xl border border-border bg-surface px-2 text-xs">
                      <option value="">Base product</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>{variant.name_en}</option>
                      ))}
                    </select>
                  ) : null}
                  <textarea
                    name="items"
                    rows={5}
                    required
                    placeholder={'[{"username":"player01","password":"secret","email":"a@b.com","notes":"recovery code …"}]'}
                    className="focus-ring w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[11px]"
                  />
                  <p className="mt-1 text-[10px] text-muted">JSON object or array (max 100). Stored encrypted; stock updates automatically.</p>
                </AdminActionForm>
              </div>
            ) : null}

            <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
              {data.inventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-[10px]">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-fg">{item.payload_hint ?? "Item"}</p>
                    <p className="text-muted">{formatDate(item.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusPill status={item.status} />
                    {canReveal ? <RevealPayload action={revealInventoryAction.bind(null, item.id)} label="Reveal" /> : null}
                    {canInventory && item.status !== "SOLD" ? (
                      <AdminActionButton
                        action={deleteInventoryAction.bind(null, item.id, id)}
                        label=""
                        icon={<Trash2 className="size-3" />}
                        variant="danger"
                        confirmText="Delete this inventory unit?"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Inventory overview</h2>
        <div className="mt-3">
          <Table className="min-w-[620px]">
            <thead><tr><Th>Hint</Th><Th>Variant</Th><Th>Status</Th><Th>Created</Th><Th>Sold at</Th></tr></thead>
            <tbody>
              {data.inventory.map((item) => (
                <tr key={item.id}>
                  <Td className="font-mono text-[10px]">{item.payload_hint ?? "—"}</Td>
                  <Td className="text-[10px]">{variants.find((variant) => variant.id === item.variant_id)?.name_en ?? "Base"}</Td>
                  <Td><StatusPill status={item.status} /></Td>
                  <Td className="text-[10px]">{formatDate(item.created_at)}</Td>
                  <Td className="text-[10px]">{item.sold_at ? formatDate(item.sold_at, true) : "—"}</Td>
                </tr>
              ))}
              {data.inventory.length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-xs text-muted">No inventory units yet.</Td></tr> : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
