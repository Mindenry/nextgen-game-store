import { AdminActionForm } from "@/components/admin/admin-action-form";
import { saveProductAction } from "@/actions/admin-catalog";
import { Input, Select, Textarea } from "@/components/ui";
import { safeJson } from "@/lib/utils";

export function ProductEditor({
  product,
  categories,
}: {
  product?: Record<string, unknown>;
  categories: { id: string; name_en: string }[];
}) {
  const features = safeJson<string[]>(product?.metadata ? (product.metadata as Record<string, unknown>).features : [], []);
  return (
    <AdminActionForm action={saveProductAction} submitLabel={product ? "Save product" : "Create product"}>
      {product ? <input type="hidden" name="id" value={String(product.id)} /> : null}

      <div className="grid gap-3.5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Name (English) <span className="text-danger">*</span></label>
          <Input name="nameEn" defaultValue={String(product?.name_en ?? "")} required maxLength={120} placeholder="Steam Wallet 500 THB" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Name (Thai) <span className="text-danger">*</span></label>
          <Input name="nameTh" defaultValue={String(product?.name_th ?? "")} required maxLength={120} placeholder="สตีมวอลเล็ท 500 บาท" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Slug</label>
          <Input name="slug" defaultValue={String(product?.slug ?? "")} maxLength={90} placeholder="auto-generated-from-name" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Category <span className="text-danger">*</span></label>
          <Select name="categoryId" defaultValue={String(product?.category_id ?? categories[0]?.id ?? "")} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name_en}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Product type</label>
          <Select name="productType" defaultValue={String(product?.product_type ?? "digital_key")}>
            <option value="digital_key">Digital key</option>
            <option value="game_account">Game account</option>
            <option value="gift_card">Gift card</option>
            <option value="service">Service</option>
            <option value="topup">Top-up (use top-up manager)</option>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Badge</label>
          <Input name="badge" defaultValue={String(product?.badge ?? "")} maxLength={30} placeholder="Best seller" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Price (THB) <span className="text-danger">*</span></label>
          <Input name="price" type="number" step="0.01" min="0" defaultValue={product ? String(product.price) : ""} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Compare-at price (THB)</label>
          <Input name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={product?.compare_at_price ? String(product.compare_at_price) : ""} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Cost price (THB)</label>
          <Input name="costPrice" type="number" step="0.01" min="0" defaultValue={product?.cost_price ? String(product.cost_price) : ""} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Stock mode</label>
          <Select name="stockMode" defaultValue={String(product?.stock_mode ?? "inventory")}>
            <option value="inventory">Inventory units (auto stock)</option>
            <option value="unlimited">Unlimited</option>
            <option value="manual">Manual stock number</option>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Stock quantity</label>
          <Input name="stockQuantity" type="number" min="0" defaultValue={product ? String(product.stock_quantity) : "0"} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Delivery method</label>
          <Select name="deliveryMethod" defaultValue={String(product?.delivery_method ?? "auto")}>
            <option value="auto">Automatic (from inventory)</option>
            <option value="manual">Manual (staff delivers)</option>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Delivery time label</label>
          <Input name="deliveryTime" defaultValue={String(product?.delivery_time ?? "Instant")} maxLength={60} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Sort order</label>
          <Input name="sortOrder" type="number" defaultValue={String(product?.sort_order ?? 0)} />
        </div>
      </div>

      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Short description</label>
        <Input name="shortDescription" defaultValue={String(product?.short_description ?? "")} maxLength={200} />
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Full description</label>
        <Textarea name="description" rows={5} defaultValue={String(product?.description ?? "")} maxLength={8000} />
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Features (one per line)</label>
        <Textarea name="features" rows={4} defaultValue={features.join("\n")} placeholder={"Instant delivery\nRegion-free\nWarranty included"} />
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-semibold text-fg-soft">Terms &amp; conditions</label>
        <Textarea name="terms" rows={3} defaultValue={String(product?.terms ?? "")} />
      </div>
      <div className="mt-3.5 flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-xs font-medium text-fg-soft">
          <input type="checkbox" name="isActive" defaultChecked={product ? Boolean(product.is_active) : true} className="accent-[var(--primary)]" />
          Active (visible in store)
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-fg-soft">
          <input type="checkbox" name="isFeatured" defaultChecked={Boolean(product?.is_featured)} className="accent-[var(--primary)]" />
          Featured on homepage
        </label>
      </div>
    </AdminActionForm>
  );
}
