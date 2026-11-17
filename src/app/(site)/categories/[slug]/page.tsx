import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { getCategories, getCategoryBySlug, listProducts } from "@/lib/catalog";
import { getLocale, localizedName } from "@/lib/i18n";
import { buttonClass, EmptyState, Pagination, SectionHeading } from "@/components/ui";
import { ProductGrid } from "@/components/product-card";
import { CategoryIcon } from "@/components/category-icon";
import { SortSelect } from "@/components/sort-select";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category || !category.is_active) notFound();

  const sort = (typeof query.sort === "string" ? query.sort : "popular") as
    | "popular" | "latest" | "price_asc" | "price_desc" | "best_selling" | "rating";
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : 1) || 1);
  const [locale, categories, result] = await Promise.all([
    getLocale(),
    getCategories(true),
    listProducts({ category: slug, sort, page, pageSize: 12 }),
  ]);
  const children = categories.filter((item) => item.parent_id === category.id);

  return (
    <div className="container-page py-8 md:py-12">
      <Link href="/products" className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All products
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_60%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CategoryIcon name={category.icon} className="size-7" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Category</p>
              <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{localizedName(category, locale)}</h1>
              <p className="mt-1 max-w-xl text-sm text-muted">
                {locale === "th" ? category.description_th : category.description_en}
              </p>
            </div>
          </div>
          <SortSelect value={sort} />
        </div>
      </div>

      {children.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {children.map((child) => (
            <Link key={child.id} href={`/categories/${child.slug}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              {localizedName(child, locale)}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-7">
        {result.items.length > 0 ? (
          <>
            <ProductGrid products={result.items} />
            <Pagination
              page={result.page}
              pages={result.pages}
              makeHref={(nextPage) => `/categories/${slug}?sort=${sort}&page=${nextPage}`}
            />
          </>
        ) : (
          <EmptyState
            icon={<PackageSearch className="size-5" />}
            title={locale === "th" ? "หมวดนี้ยังไม่มีสินค้า" : "No products in this category yet"}
            description={locale === "th" ? "กลับมาดูใหม่เร็ว ๆ นี้" : "Check back soon, or browse other categories."}
            action={<Link href="/products" className={buttonClass({ size: "sm" })}>Browse all products</Link>}
          />
        )}
      </div>

      {categories.length > 6 ? (
        <div className="mt-14">
          <SectionHeading title={locale === "th" ? "หมวดหมู่อื่น ๆ" : "Other categories"} />
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((item) => item.id !== category.id)
              .slice(0, 10)
              .map((item) => (
                <Link key={item.id} href={`/categories/${item.slug}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                  <CategoryIcon name={item.icon} className="size-3.5 text-primary" />
                  {localizedName(item, locale)}
                </Link>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
