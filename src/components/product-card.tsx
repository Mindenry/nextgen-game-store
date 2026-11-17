import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import type { ProductCard as Product } from "@/lib/catalog";
import { formatTHB, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";

const GRADIENTS = [
  "from-violet-500/25 via-indigo-500/10 to-transparent",
  "from-cyan-500/25 via-sky-500/10 to-transparent",
  "from-fuchsia-500/20 via-rose-500/10 to-transparent",
  "from-emerald-500/20 via-teal-500/10 to-transparent",
  "from-amber-500/20 via-orange-500/10 to-transparent",
];

export function ProductImage({
  imageUrl,
  name,
  icon,
  index = 0,
  className,
  iconClassName,
}: {
  imageUrl: string | null;
  name: string;
  icon: string;
  index?: number;
  className?: string;
  iconClassName?: string;
}) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(255,255,255,0.28),transparent_45%)] dark:bg-[radial-gradient(circle_at_75%_15%,rgba(255,255,255,0.07),transparent_45%)]" />
      {imageUrl ? (
         
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <CategoryIcon name={icon} className={cn("size-12 text-fg/35", iconClassName)} strokeWidth={1.2} />
        </div>
      )}
      {imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" /> : null}
    </div>
  );
}

export function ProductCard({
  product,
  index = 0,
  className,
  priority,
}: {
  product: Product;
  index?: number;
  className?: string;
  priority?: boolean;
}) {
  const price = toMinor(product.price);
  const compare = product.compare_at_price ? toMinor(product.compare_at_price) : null;
  const discount = compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
  const stock =
    product.stock_mode === "unlimited" ? null : Number(product.stock_quantity);

  return (
    <article
      className={cn(
        "group surface-card relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <Link href={`/products/${product.slug}`} className="relative block">
        <ProductImage
          imageUrl={product.image_url}
          name={product.name_en}
          icon={product.category_icon}
          index={index}
          className="aspect-[4/3] w-full"
          iconClassName="transition duration-500 group-hover:scale-110"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.badge ? <Badge tone="primary" className="shadow-sm">{product.badge}</Badge> : null}
          {discount > 0 ? <Badge tone="danger" className="shadow-sm">-{discount}%</Badge> : null}
        </div>
        {stock !== null && stock <= 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="truncate">{product.category_name_en}</span>
          {product.rating_count > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-warning">
              <Star className="size-3 fill-current" />
              {Number(product.rating_avg).toFixed(1)}
            </span>
          ) : null}
        </div>
        <Link href={`/products/${product.slug}`} className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-fg hover:text-primary">
          {product.name_en}
        </Link>
        {product.short_description ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted">{product.short_description}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="tabular text-[17px] font-semibold text-fg">{formatTHB(product.price)}</span>
              {compare && compare > price ? (
                <span className="tabular text-[11px] text-muted line-through">{formatTHB(product.compare_at_price!)}</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              {product.delivery_method === "auto" ? "Instant delivery" : "Manual delivery"} · {product.sold_count} sold
            </p>
          </div>
          <Link
            href={`/products/${product.slug}`}
            aria-label={`View ${product.name_en}`}
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4", className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}
