import { Megaphone, Plus, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listPromotions } from "@/lib/admin";
import { Badge, Card, Input, Select, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { deleteContentAction, savePromotionAction } from "@/actions/admin-content";

export const metadata = { title: "Promotions" };

export default async function AdminPromotionsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.promotionsManage)) return <AccessDenied permission={PERMISSIONS.promotionsManage} />;
  const promotions = await listPromotions();

  return (
    <div>
      <PageHeader
        eyebrow="Marketing"
        title="Promotions"
        description="Promotional cards shown on the homepage. Schedule by date and control ordering; inactive cards never render."
      />

      <Card className="mb-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-primary" /> New promotion</h2>
        <div className="mt-3">
          <AdminActionForm action={savePromotionAction} submitLabel="Create promotion" compact>
            <PromotionFields />
          </AdminActionForm>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {promotions.map((promotion) => {
          const row = promotion as Record<string, unknown>;
          return (
            <Card key={String(row.id)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Megaphone className="size-4" /></span>
                  <div>
                    <p className="text-xs font-semibold text-fg">{String(row.title)}</p>
                    <p className="text-[10px] text-muted">{String(row.subtitle ?? "")}</p>
                  </div>
                </div>
                <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Hidden"}</Badge>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Edit</summary>
                <div className="mt-2 border-t border-border pt-3">
                  <AdminActionForm action={savePromotionAction} submitLabel="Save promotion" compact>
                    <input type="hidden" name="id" value={String(row.id)} />
                    <PromotionFields promotion={row} />
                  </AdminActionForm>
                  <div className="mt-2">
                    <AdminActionButton
                      action={deleteContentAction.bind(null, "promotion", String(row.id))}
                      label="Delete"
                      variant="danger"
                      icon={<Trash2 className="size-3" />}
                      confirmText="Delete this promotion?"
                    />
                  </div>
                </div>
              </details>
            </Card>
          );
        })}
        {promotions.length === 0 ? <Card className="p-8 text-center text-xs text-muted md:col-span-2">No promotions yet.</Card> : null}
      </div>
    </div>
  );
}

function PromotionFields({ promotion }: { promotion?: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <Input name="title" required defaultValue={String(promotion?.title ?? "")} placeholder="Promotion title" className="!h-9 !text-xs" />
      <Input name="subtitle" defaultValue={String(promotion?.subtitle ?? "")} placeholder="Subtitle" className="!h-9 !text-xs" />
      <Input name="imageUrl" defaultValue={String(promotion?.image_url ?? "")} placeholder="Image URL (optional)" className="!h-9 !text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Input name="ctaLabel" defaultValue={String(promotion?.cta_label ?? "")} placeholder="CTA label" className="!h-9 !text-xs" />
        <Input name="ctaUrl" defaultValue={String(promotion?.cta_url ?? "")} placeholder="/products?..." className="!h-9 !text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input name="badge" defaultValue={String(promotion?.badge ?? "")} placeholder="Badge" className="!h-9 !text-xs" />
        <Input name="sortOrder" type="number" defaultValue={String(promotion?.sort_order ?? 0)} placeholder="Sort" className="!h-9 !text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input name="startsAt" type="datetime-local" defaultValue={promotion?.starts_at ? String(promotion.starts_at).slice(0, 16) : ""} className="!h-9 !text-[11px]" />
        <Input name="endsAt" type="datetime-local" defaultValue={promotion?.ends_at ? String(promotion.ends_at).slice(0, 16) : ""} className="!h-9 !text-[11px]" />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-fg-soft">
        <input type="checkbox" name="isActive" defaultChecked={promotion ? Boolean(promotion.is_active) : true} className="accent-[var(--primary)]" /> Active
      </label>
      <Textarea name="note" rows={0} className="hidden" />
    </div>
  );
}
