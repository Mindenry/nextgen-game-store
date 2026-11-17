import { Plus, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getCategories } from "@/lib/catalog";
import { Card, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { deleteCategoryAction, saveCategoryAction } from "@/actions/admin-catalog";
import { CategoryIcon } from "@/components/category-icon";

export const metadata = { title: "Categories" };

const ICONS = ["Gamepad2", "Zap", "MonitorPlay", "Boxes", "Blocks", "Smartphone", "PcCase", "Gift", "KeyRound", "Sparkles", "Package"];
const ACCENTS = ["violet", "cyan", "sky", "emerald", "rose", "amber", "indigo", "fuchsia", "teal", "orange"];

export default async function AdminCategoriesPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.categoriesManage)) return <AccessDenied permission={PERMISSIONS.categoriesManage} />;
  const categories = await getCategories(false);

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="Organise the storefront. Categories can be nested one level and reordered with the sort field."
      />

      <Card className="mb-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-primary" /> New category</h2>
        <div className="mt-3">
          <AdminActionForm action={saveCategoryAction} submitLabel="Create category" compact>
            <CategoryFields categories={categories} />
          </AdminActionForm>
        </div>
      </Card>

      <div className="space-y-3">
        {categories.map((category) => (
          <Card key={category.id} className="p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CategoryIcon name={category.icon} className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">{category.name_en}</p>
                    <p className="font-mono text-[10px] text-muted">{category.slug} · {category.product_count ?? 0} products</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold ${category.is_active ? "text-success" : "text-muted"}`}>
                  {category.is_active ? "Active" : "Hidden"}
                </span>
              </summary>
              <div className="mt-4 border-t border-border pt-4">
                <AdminActionForm action={saveCategoryAction} submitLabel="Save category" compact>
                  <input type="hidden" name="id" value={category.id} />
                  <CategoryFields category={category} categories={categories} />
                </AdminActionForm>
                <div className="mt-3">
                  <AdminActionButton
                    action={deleteCategoryAction.bind(null, category.id)}
                    label="Delete category"
                    variant="danger"
                    icon={<Trash2 className="size-3" />}
                    confirmText={`Delete ${category.name_en}? Categories with products cannot be deleted.`}
                  />
                </div>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CategoryFields({
  category,
  categories,
}: {
  category?: {
    id: string;
    name_en: string;
    name_th: string;
    slug: string;
    parent_id: string | null;
    icon: string;
    accent: string;
    sort_order: number;
    is_active: boolean;
    description_th: string | null;
    description_en: string | null;
  };
  categories: { id: string; name_en: string }[];
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Name (EN)</label>
          <Input name="nameEn" defaultValue={category?.name_en ?? ""} required />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Name (TH)</label>
          <Input name="nameTh" defaultValue={category?.name_th ?? ""} required />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Slug</label>
          <Input name="slug" defaultValue={category?.slug ?? ""} placeholder="auto" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Parent (optional)</label>
          <Select name="parentId" defaultValue={category?.parent_id ?? ""}>
            <option value="">Top level</option>
            {categories.filter((item) => item.id !== category?.id).map((item) => (
              <option key={item.id} value={item.id}>{item.name_en}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Icon</label>
          <Select name="icon" defaultValue={category?.icon ?? "Gamepad2"}>
            {ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Accent</label>
          <Select name="accent" defaultValue={category?.accent ?? "violet"}>
            {ACCENTS.map((accent) => <option key={accent} value={accent}>{accent}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">Sort order</label>
          <Input name="sortOrder" type="number" defaultValue={category?.sort_order ?? 0} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-[11px] font-medium text-fg-soft">
          <input type="checkbox" name="isActive" defaultChecked={category?.is_active ?? true} className="accent-[var(--primary)]" /> Active
        </label>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Textarea name="descriptionEn" rows={2} defaultValue={category?.description_en ?? ""} placeholder="Description (EN)" />
        <Textarea name="descriptionTh" rows={2} defaultValue={category?.description_th ?? ""} placeholder="Description (TH)" />
      </div>
    </>
  );
}
