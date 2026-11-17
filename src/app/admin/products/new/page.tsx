import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { getCategories } from "@/lib/catalog";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.productsManage)) return <AccessDenied permission={PERMISSIONS.productsManage} />;
  const categories = await getCategories(false);

  return (
    <div>
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Products
      </Link>
      <PageHeader
        eyebrow="Catalogue"
        title="Create product"
        description="Add a product, then upload images, variants and encrypted inventory units on its edit page."
      />
      <Card className="p-5">
        <ProductEditor categories={categories.map((category) => ({ id: category.id, name_en: category.name_en }))} />
      </Card>
    </div>
  );
}
