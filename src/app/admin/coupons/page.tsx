import { Plus, TicketPercent } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listCoupons } from "@/lib/admin";
import { many } from "@/lib/db";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Input, Select, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { saveCouponAction, toggleCouponAction } from "@/actions/admin-content";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.couponsManage)) return <AccessDenied permission={PERMISSIONS.couponsManage} />;
  const [coupons, products, categories] = await Promise.all([
    listCoupons(),
    many<{ id: string; slug: string }>("select id, slug from products"),
    many<{ id: string; slug: string }>("select id, slug from categories"),
  ]);
  const productSlugs = new Map(products.map((row) => [row.id, row.slug]));
  const categorySlugs = new Map(categories.map((row) => [row.id, row.slug]));

  return (
    <div>
      <PageHeader
        eyebrow="Marketing"
        title="Coupons"
        description="Discount codes are validated server-side at checkout, including usage limits, per-user limits and product/category restrictions."
      />

      <Card className="mb-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-primary" /> Create coupon</h2>
        <div className="mt-3">
          <AdminActionForm action={saveCouponAction} submitLabel="Create coupon" compact>
            <CouponFields productSlugs={productSlugs} categorySlugs={categorySlugs} />
          </AdminActionForm>
        </div>
      </Card>

      <div className="space-y-3">
        {coupons.map((coupon) => (
          <Card key={coupon.id} className="p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><TicketPercent className="size-4" /></span>
                  <div>
                    <p className="font-mono text-sm font-bold text-fg">{coupon.code}</p>
                    <p className="text-[10px] text-muted">
                      {coupon.type === "percentage" ? `${Number(coupon.value)}% off` : `${formatTHB(coupon.value)} off`} · used {coupon.used_count}
                      {coupon.usage_limit ? `/${coupon.usage_limit}` : ""} · min {formatTHB(coupon.min_order)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {coupon.expires_at ? <span className="text-[10px] text-muted">exp {formatDate(coupon.expires_at)}</span> : null}
                  <Badge tone={coupon.is_active ? "success" : "neutral"}>{coupon.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </summary>
              <div className="mt-4 border-t border-border pt-4">
                <AdminActionForm action={saveCouponAction} submitLabel="Save coupon" compact>
                  <input type="hidden" name="id" value={coupon.id} />
                  <CouponFields coupon={coupon} productSlugs={productSlugs} categorySlugs={categorySlugs} />
                </AdminActionForm>
                <div className="mt-3">
                  <AdminActionButton
                    action={toggleCouponAction.bind(null, coupon.id)}
                    label={coupon.is_active ? "Deactivate" : "Activate"}
                    variant={coupon.is_active ? "danger" : "success"}
                    confirmText="Toggle this coupon's active state?"
                  />
                </div>
              </div>
            </details>
          </Card>
        ))}
        {coupons.length === 0 ? <Card className="p-8 text-center text-xs text-muted">No coupons yet.</Card> : null}
      </div>
    </div>
  );
}

function CouponFields({
  coupon,
  productSlugs,
  categorySlugs,
}: {
  productSlugs: Map<string, string>;
  categorySlugs: Map<string, string>;
  coupon?: {
    code: string;
    description: string | null;
    type: string;
    value: string;
    min_order: string;
    max_discount: string | null;
    starts_at: string | null;
    expires_at: string | null;
    usage_limit: number | null;
    per_user_limit: number;
    is_active: boolean;
    first_purchase_only: boolean;
    applies_to: Record<string, unknown>;
  };
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Code</label>
          <Input name="code" defaultValue={coupon?.code ?? ""} required minLength={3} placeholder="NEXTGEN10" className="uppercase" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Type</label>
          <Select name="type" defaultValue={coupon?.type ?? "percentage"}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Value</label>
          <Input name="value" defaultValue={coupon?.value ?? ""} required type="number" step="0.01" placeholder="10" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Minimum order (THB)</label>
          <Input name="minOrder" defaultValue={coupon?.min_order ?? "0"} type="number" step="0.01" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Maximum discount (THB)</label>
          <Input name="maxDiscount" defaultValue={coupon?.max_discount ?? ""} type="number" step="0.01" placeholder="optional" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Usage limit (total)</label>
          <Input name="usageLimit" defaultValue={coupon?.usage_limit ?? ""} type="number" min="1" placeholder="unlimited" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Per-user limit</label>
          <Input name="perUserLimit" defaultValue={coupon?.per_user_limit ?? 1} type="number" min="1" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Starts at</label>
          <Input name="startsAt" defaultValue={coupon?.starts_at ? coupon.starts_at.slice(0, 16) : ""} type="datetime-local" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Expires at</label>
          <Input name="expiresAt" defaultValue={coupon?.expires_at ? coupon.expires_at.slice(0, 16) : ""} type="datetime-local" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Product slugs (comma separated)</label>
          <Input
            name="productSlugs"
            defaultValue={(coupon?.applies_to?.product_ids as string[] | undefined)?.map((id) => productSlugs.get(id) ?? "").filter(Boolean).join(", ") ?? ""}
            placeholder="optional restriction"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Category slugs (comma separated)</label>
          <Input
            name="categorySlugs"
            defaultValue={(coupon?.applies_to?.category_ids as string[] | undefined)?.map((id) => categorySlugs.get(id) ?? "").filter(Boolean).join(", ") ?? ""}
            placeholder="optional restriction"
          />
        </div>
      </div>
      <Textarea name="description" rows={2} defaultValue={coupon?.description ?? ""} placeholder="Customer-facing description" className="mt-2" />
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-fg-soft">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="firstPurchaseOnly" defaultChecked={coupon?.first_purchase_only} className="accent-[var(--primary)]" /> First purchase only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={coupon?.is_active ?? true} className="accent-[var(--primary)]" /> Active
        </label>
      </div>
    </>
  );
}
