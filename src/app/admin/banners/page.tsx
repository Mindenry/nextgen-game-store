import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listBanners } from "@/lib/admin";
import { Badge, Card, Input, Select } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { deleteContentAction, saveBannerAction } from "@/actions/admin-content";

export const metadata = { title: "Banners" };

export default async function AdminBannersPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.bannersManage)) return <AccessDenied permission={PERMISSIONS.bannersManage} />;
  const banners = await listBanners();

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Banner management"
        description="Homepage hero banners. The first active hero banner replaces the default hero copy on the storefront."
      />

      <Card className="mb-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-primary" /> New banner</h2>
        <div className="mt-3">
          <AdminActionForm action={saveBannerAction} submitLabel="Create banner" compact>
            <BannerFields />
          </AdminActionForm>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {banners.map((banner) => {
          const row = banner as Record<string, unknown>;
          return (
            <Card key={String(row.id)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><ImageIcon className="size-4" /></span>
                  <div>
                    <p className="text-xs font-semibold text-fg">{String(row.title)}</p>
                    <p className="text-[10px] text-muted">{String(row.placement)} · order {String(row.sort_order)}</p>
                  </div>
                </div>
                <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Hidden"}</Badge>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Edit</summary>
                <div className="mt-2 border-t border-border pt-3">
                  <AdminActionForm action={saveBannerAction} submitLabel="Save banner" compact>
                    <input type="hidden" name="id" value={String(row.id)} />
                    <BannerFields banner={row} />
                  </AdminActionForm>
                  <div className="mt-2">
                    <AdminActionButton
                      action={deleteContentAction.bind(null, "banner", String(row.id))}
                      label="Delete"
                      variant="danger"
                      icon={<Trash2 className="size-3" />}
                      confirmText="Delete this banner?"
                    />
                  </div>
                </div>
              </details>
            </Card>
          );
        })}
        {banners.length === 0 ? <Card className="p-8 text-center text-xs text-muted md:col-span-2">No banners yet. The storefront uses its default hero design.</Card> : null}
      </div>
    </div>
  );
}

function BannerFields({ banner }: { banner?: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <Input name="title" required defaultValue={String(banner?.title ?? "")} placeholder="Headline" className="!h-9 !text-xs" />
      <Input name="subtitle" defaultValue={String(banner?.subtitle ?? "")} placeholder="Subheadline" className="!h-9 !text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Select name="placement" defaultValue={String(banner?.placement ?? "hero")} className="!h-9 !text-[11px]">
          <option value="hero">Hero</option>
          <option value="promo">Promo</option>
          <option value="announcement">Announcement</option>
        </Select>
        <Input name="sortOrder" type="number" defaultValue={String(banner?.sort_order ?? 0)} placeholder="Sort" className="!h-9 !text-xs" />
      </div>
      <Input name="imageUrl" defaultValue={String(banner?.image_url ?? "")} placeholder="Image URL (optional)" className="!h-9 !text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Input name="ctaLabel" defaultValue={String(banner?.cta_label ?? "")} placeholder="CTA label" className="!h-9 !text-xs" />
        <Input name="ctaUrl" defaultValue={String(banner?.cta_url ?? "")} placeholder="/topup" className="!h-9 !text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input name="startsAt" type="datetime-local" defaultValue={banner?.starts_at ? String(banner.starts_at).slice(0, 16) : ""} className="!h-9 !text-[11px]" />
        <Input name="endsAt" type="datetime-local" defaultValue={banner?.ends_at ? String(banner.ends_at).slice(0, 16) : ""} className="!h-9 !text-[11px]" />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-fg-soft">
        <input type="checkbox" name="isActive" defaultChecked={banner ? Boolean(banner.is_active) : true} className="accent-[var(--primary)]" /> Active
      </label>
    </div>
  );
}
