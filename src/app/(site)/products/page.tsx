import Link from "next/link";
import { Filter, PackageSearch, Search as SearchIcon } from "lucide-react";
import { getCategories, listProducts } from "@/lib/catalog";
import { getLocale, translate } from "@/lib/i18n";
import { buttonClass, EmptyState, Input, Pagination, Select, Field, Badge } from "@/components/ui";
import { ProductGrid } from "@/components/product-card";
import { SortSelect } from "@/components/sort-select";
import { localizedName } from "@/lib/i18n";

export const metadata = { title: "All products" };

function toNumber(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : "";
  const sort = (typeof params.sort === "string" ? params.sort : "popular") as
    | "popular" | "latest" | "price_asc" | "price_desc" | "best_selling" | "rating";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const minPrice = toNumber(params.min);
  const maxPrice = toNumber(params.max);
  const inStock = params.inStock === "1";

  const [locale, categories, result] = await Promise.all([
    getLocale(),
    getCategories(true),
    listProducts({ q, category, minPrice, maxPrice, inStock, sort, page, pageSize: 12 }),
  ]);
  const tr = (key: string) => translate(locale, key);

  function makeHref(nextPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    if (sort !== "popular") next.set("sort", sort);
    if (minPrice !== undefined) next.set("min", String(minPrice));
    if (maxPrice !== undefined) next.set("max", String(maxPrice));
    if (inStock) next.set("inStock", "1");
    next.set("page", String(nextPage));
    return `/products?${next.toString()}`;
  }

  const activeCategory = categories.find((item) => item.slug === category);

  return (
    <div className="container-page py-8 md:py-12">
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-fg">Home</Link>
        <span>/</span>
        <span className="text-fg-soft">Products</span>
        {activeCategory ? (
          <>
            <span>/</span>
            <span className="text-fg-soft">{localizedName(activeCategory, locale)}</span>
          </>
        ) : null}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {locale === "th" ? "แคตตาล็อก" : "Catalogue"}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold">
            {q ? `“${q}”` : activeCategory ? localizedName(activeCategory, locale) : tr("nav.products")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {result.total} {locale === "th" ? "รายการ" : "products"}
            {q ? (locale === "th" ? " ที่ตรงกับคำค้น" : " matching your search") : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{tr("common.sort")}</span>
          <SortSelect value={sort} />
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <form method="get" className="surface-card sticky top-24 space-y-4 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Filter className="size-4 text-primary" />
              {tr("common.filters")}
            </div>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="sort" value={sort} />
            <Field label={locale === "th" ? "หมวดหมู่" : "Category"}>
              <Select name="category" defaultValue={category}>
                <option value="">{locale === "th" ? "ทุกหมวดหมู่" : "All categories"}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {localizedName(item, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("common.priceRange")}>
              <div className="grid grid-cols-2 gap-2">
                <Input name="min" type="number" min="0" step="0.01" placeholder={tr("common.min")} defaultValue={minPrice} />
                <Input name="max" type="number" min="0" step="0.01" placeholder={tr("common.max")} defaultValue={maxPrice} />
              </div>
            </Field>
            <label className="flex items-center gap-2 text-xs text-fg-soft">
              <input type="checkbox" name="inStock" value="1" defaultChecked={inStock} className="size-3.5 rounded border-border accent-[var(--primary)]" />
              {locale === "th" ? "แสดงเฉพาะที่มีสินค้า" : "In stock only"}
            </label>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass({ size: "sm", className: "flex-1" })}>
                {tr("common.apply")}
              </button>
              <Link href="/products" className={buttonClass({ variant: "outline", size: "sm" })}>
                {tr("common.reset")}
              </Link>
            </div>
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Quick filters</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href="/products?sort=latest" className={buttonClass({ variant: "secondary", size: "sm" })}>New</Link>
                <Link href="/products?sort=best_selling" className={buttonClass({ variant: "secondary", size: "sm" })}>Best sellers</Link>
                <Link href="/products?inStock=1" className={buttonClass({ variant: "secondary", size: "sm" })}>Available</Link>
              </div>
            </div>
          </form>
        </aside>

        <div>
          {result.items.length > 0 ? (
            <>
              <ProductGrid products={result.items} className="lg:grid-cols-3 xl:grid-cols-4" />
              <Pagination page={result.page} pages={result.pages} makeHref={makeHref} />
            </>
          ) : (
            <EmptyState
              icon={<PackageSearch className="size-5" />}
              title={locale === "th" ? "ไม่พบสินค้า" : "No products found"}
              description={
                locale === "th"
                  ? "ลองเปลี่ยนคำค้นหรือตัวกรอง หรือเลือกดูสินค้าทั้งหมด"
                  : "Try a different keyword or filter, or browse the full catalogue."
              }
              action={
                <Link href="/products" className={buttonClass({ variant: "outline", size: "sm" })}>
                  <SearchIcon className="size-3.5" /> {tr("common.reset")}
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
