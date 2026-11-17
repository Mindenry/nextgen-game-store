import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Heart,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import { getCategoryBySlug, getProductBySlug, getRelatedProducts, getReviewsForProduct } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getLocale, localizedName, translate } from "@/lib/i18n";
import { safeJson } from "@/lib/utils";
import { formatTHB, toMinor } from "@/lib/money";
import { Badge, buttonClass, SectionHeading, Separator } from "@/components/ui";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchase } from "@/components/product-purchase";
import { ProductGrid } from "@/components/product-card";
import { TrackView } from "@/components/track-view";
import { toggleFavoriteAction } from "@/actions/account";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name_en,
    description: product.short_description ?? undefined,
    openGraph: {
      title: product.name_en,
      description: product.short_description ?? undefined,
      images: product.image_url ? [product.image_url] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [locale, reviews, related, recent, user, category, favorite] = await Promise.all([
    getLocale(),
    getReviewsForProduct(product.id),
    getRelatedProducts(product.id, product.category_id, 4),
    getRecentlyViewed(product.id),
    getCurrentUser(),
    getCategoryBySlug(product.category_slug),
    getCurrentUser().then(async (current) =>
      current
        ? Boolean(
            await one("select product_id from favorites where user_id = $1 and product_id = $2", [
              current.id,
              product.id,
            ]),
          )
        : false,
    ),
  ]);

  const name = locale === "th" ? product.name_th : product.name_en;
  const description = product.description ?? product.short_description ?? "";
  const features = safeJson<string[]>(product.metadata?.features, []);
  const discount =
    product.compare_at_price && toMinor(product.compare_at_price) > toMinor(product.price)
      ? Math.round(((toMinor(product.compare_at_price) - toMinor(product.price)) / toMinor(product.compare_at_price)) * 100)
      : 0;
  const soldOut = product.stock_mode !== "unlimited" && product.stock_quantity <= 0 && product.available_units <= 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name_en,
    description: product.short_description ?? "",
    image: product.image_url ?? undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "THB",
      price: Number(product.price).toFixed(2),
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
    aggregateRating:
      product.rating_count > 0
        ? { "@type": "AggregateRating", ratingValue: product.rating_avg, reviewCount: product.rating_count }
        : undefined,
  };

  return (
    <div className="container-page py-8 md:py-12">
      <TrackView productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-fg">Home</Link>
        <ChevronRight className="size-3" />
        <Link href="/products" className="hover:text-fg">Products</Link>
        <ChevronRight className="size-3" />
        {category ? (
          <>
            <Link href={`/categories/${category.slug}`} className="hover:text-fg">
              {localizedName(category, locale)}
            </Link>
            <ChevronRight className="size-3" />
          </>
        ) : null}
        <span className="truncate text-fg-soft">{name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={name} icon={product.category_icon} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.badge ? <Badge tone="primary">{product.badge}</Badge> : null}
            {discount > 0 ? <Badge tone="danger">Save {discount}%</Badge> : null}
            <Badge tone={soldOut ? "danger" : "success"}>{soldOut ? "Out of stock" : "Available"}</Badge>
            <span className="text-[11px] text-muted">{product.sold_count} sold</span>
          </div>

          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-[34px]">{name}</h1>
          {product.short_description ? <p className="mt-2 text-sm leading-relaxed text-muted">{product.short_description}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
            {product.rating_count > 0 ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <Star className="size-3.5 fill-current" />
                <span className="font-semibold text-fg">{Number(product.rating_avg).toFixed(1)}</span>
                ({product.rating_count} reviews)
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
            <span className="inline-flex items-center gap-1">
              <PackageCheck className="size-3.5 text-primary" /> {product.delivery_method === "auto" ? "Automatic delivery" : "Manual delivery"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 text-primary" /> {product.delivery_time}
            </span>
          </div>

          <div className="mt-6">
            <ProductPurchase
              productId={product.id}
              basePrice={product.price}
              baseCompare={product.compare_at_price}
              stockMode={product.stock_mode}
              stockQuantity={product.stock_quantity}
              availableUnits={product.available_units}
              variants={product.variants}
            />
          </div>

          <div className="mt-5 flex items-center gap-2">
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className={buttonClass({ variant: "outline", size: "sm" })}>
                <Heart className={favorite ? "size-3.5 fill-danger text-danger" : "size-3.5"} />
                {favorite ? "Saved" : "Save for later"}
              </button>
            </form>
            <Link href="/dashboard/support" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Ask a question
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Verified stock", body: "Delivered from secure inventory" },
              { icon: Zap, title: product.delivery_method === "auto" ? "Instant delivery" : "Handled by staff", body: product.delivery_time },
              { icon: RotateCcw, title: "Support backed", body: "Ticket support on every order" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2 rounded-xl border border-border bg-surface-2/60 p-3">
                <item.icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <p className="text-[11px] font-semibold text-fg">{item.title}</p>
                  <p className="text-[10px] text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">{translate(locale, "product.description")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-soft">
              {description || (locale === "th" ? "ยังไม่มีรายละเอียดสินค้า" : "No description has been added yet.")}
            </p>
            {features.length > 0 ? (
              <>
                <Separator className="my-5" />
                <h3 className="text-sm font-semibold">{translate(locale, "product.features")}</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-fg-soft">
                      <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">{translate(locale, "product.reviews")}</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{translate(locale, "product.noReviews")}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-fg-soft">
                          {review.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-fg">{review.display_name}</span>
                        <Badge tone="success" className="text-[9px]">Verified purchase</Badge>
                      </div>
                      <span className="text-[10px] text-muted">{formatDate(review.created_at)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-0.5 text-warning">
                      {Array.from({ length: review.rating }).map((_, index) => (
                        <Star key={index} className="size-3 fill-current" />
                      ))}
                    </div>
                    {review.title ? <p className="mt-1.5 text-sm font-semibold text-fg">{review.title}</p> : null}
                    {review.body ? <p className="mt-1 text-sm leading-relaxed text-muted">{review.body}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">{translate(locale, "product.delivery")}</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{translate(locale, "product.deliveryTime")}</dt>
                <dd className="font-medium text-fg">{product.delivery_time}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Method</dt>
                <dd className="font-medium capitalize text-fg">{product.delivery_method}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Category</dt>
                <dd className="font-medium text-fg">{product.category_name_en}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Price</dt>
                <dd className="tabular font-semibold text-fg">{formatTHB(product.price)}</dd>
              </div>
            </dl>
          </div>
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">{translate(locale, "product.terms")}</h3>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted">
              {product.terms ||
                (locale === "th"
                  ? "สินค้าดิจิทัลไม่สามารถคืนได้หลังส่งมอบ โปรดตรวจสอบรายละเอียดก่อนซื้อ"
                  : "Digital goods are non-refundable once delivered. Please review the details before purchase.")}
            </p>
            <Link href="/legal/refund" className="mt-3 inline-block text-[11px] font-semibold text-primary hover:underline">
              Read the refund policy →
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-14">
          <SectionHeading
            title={translate(locale, "product.related")}
            action={<Link href={`/categories/${product.category_slug}`} className={buttonClass({ variant: "ghost", size: "sm" })}>View category</Link>}
          />
          <ProductGrid products={related} />
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-14">
          <SectionHeading title={locale === "th" ? "ดูล่าสุด" : "Recently viewed"} />
          <ProductGrid products={recent} />
        </section>
      ) : null}
    </div>
  );
}
