import "server-only";
import { many, one } from "@/lib/db";
import { CARD_COLUMNS } from "@/lib/catalog-sql";

export type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_th: string;
  name_en: string;
  description_th: string | null;
  description_en: string | null;
  icon: string;
  accent: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
};

export type ProductCard = {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  short_description: string | null;
  product_type: string;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
  stock_mode: string;
  sold_count: number;
  badge: string | null;
  is_featured: boolean;
  delivery_method: string;
  delivery_time: string;
  rating_avg: string;
  rating_count: number;
  created_at: string;
  category_slug: string;
  category_name_th: string;
  category_name_en: string;
  category_icon: string;
  image_url: string | null;
};

export type ProductVariant = {
  id: string;
  name_th: string;
  name_en: string;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  terms: string | null;
  category_id: string;
  stock_mode: string;
  metadata: Record<string, unknown>;
  images: { id: string; url: string; alt: string | null }[];
  variants: ProductVariant[];
  available_units: number;
};

const CARD_SELECT = `select ${CARD_COLUMNS} from products p join categories c on c.id = p.category_id`;

export async function getCategories(activeOnly = true): Promise<Category[]> {
  return many<Category>(
    `select c.*, (
       select count(*)::int from products p where p.category_id = c.id and p.is_active
     ) as product_count
     from categories c
     ${activeOnly ? "where c.is_active" : ""}
     order by c.sort_order asc, c.name_en asc`,
  );
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return one<Category>("select * from categories where slug = $1", [slug]);
}

export type ProductFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "popular" | "latest" | "price_asc" | "price_desc" | "best_selling" | "rating";
  page?: number;
  pageSize?: number;
  featured?: boolean;
  type?: string;
};

const SORT_SQL: Record<NonNullable<ProductFilters["sort"]>, string> = {
  popular: "p.sold_count desc, p.created_at desc",
  latest: "p.created_at desc",
  price_asc: "p.price asc",
  price_desc: "p.price desc",
  best_selling: "p.sold_count desc",
  rating: "p.rating_avg desc, p.rating_count desc",
};

export async function listProducts(filters: ProductFilters): Promise<{
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(48, Math.max(4, Math.floor(filters.pageSize ?? 12)));
  const values: unknown[] = [];
  const where: string[] = ["p.is_active"];

  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    where.push(`(p.name_th ilike $${values.length} or p.name_en ilike $${values.length} or p.short_description ilike $${values.length})`);
  }
  if (filters.category) {
    values.push(filters.category);
    where.push(`(c.slug = $${values.length} or c.parent_id = (select id from categories where slug = $${values.length}))`);
  }
  if (typeof filters.minPrice === "number" && Number.isFinite(filters.minPrice)) {
    values.push(filters.minPrice);
    where.push(`p.price >= $${values.length}`);
  }
  if (typeof filters.maxPrice === "number" && Number.isFinite(filters.maxPrice)) {
    values.push(filters.maxPrice);
    where.push(`p.price <= $${values.length}`);
  }
  if (filters.inStock) {
    where.push(`(p.stock_mode = 'unlimited' or p.stock_quantity > 0)`);
  }
  if (filters.featured) where.push("p.is_featured");
  if (filters.type) {
    values.push(filters.type);
    where.push(`p.product_type = $${values.length}`);
  }

  const whereSql = `where ${where.join(" and ")}`;
  const sortSql = SORT_SQL[filters.sort ?? "popular"];

  const countRow = await one<{ count: number }>(
    `select count(*)::int as count from products p join categories c on c.id = p.category_id ${whereSql}`,
    values,
  );
  const total = Number(countRow?.count ?? 0);

  values.push(pageSize, (page - 1) * pageSize);
  const items = await many<ProductCard>(
    `${CARD_SELECT} ${whereSql} order by ${sortSql} limit $${values.length - 1} offset $${values.length}`,
    values,
  );

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await one<ProductDetail>(`${CARD_SELECT} where p.slug = $1 and p.is_active`, [slug]);
  if (!product) return null;
  const [images, variants, units] = await Promise.all([
    many<{ id: string; url: string; alt: string | null }>(
      "select id, url, alt from product_images where product_id = $1 order by sort_order asc",
      [product.id],
    ),
    many<ProductVariant>(
      "select id, name_th, name_en, sku, price, compare_at_price, stock_quantity, is_active, sort_order, metadata from product_variants where product_id = $1 order by sort_order asc",
      [product.id],
    ),
    one<{ count: number }>(
      "select count(*)::int as count from product_inventory where product_id = $1 and status = 'AVAILABLE'",
      [product.id],
    ),
  ]);
  return { ...product, images, variants, available_units: Number(units?.count ?? 0) };
}

export async function getProductsByIds(ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  return many<ProductCard>(`${CARD_SELECT} where p.id = any($1::uuid[]) and p.is_active`, [ids]);
}

export async function getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<ProductCard[]> {
  return many<ProductCard>(
    `${CARD_SELECT} where p.is_active and p.category_id = $1 and p.id <> $2 order by p.sold_count desc limit $3`,
    [categoryId, productId, limit],
  );
}

export async function getHomeData() {
  const [categories, featured, newArrivals, bestSellers, recommended, promotions, banners] = await Promise.all([
    getCategories(true),
    many<ProductCard>(`${CARD_SELECT} where p.is_active and p.is_featured order by p.sort_order asc, p.sold_count desc limit 8`),
    many<ProductCard>(`${CARD_SELECT} where p.is_active order by p.created_at desc limit 8`),
    many<ProductCard>(`${CARD_SELECT} where p.is_active order by p.sold_count desc limit 8`),
    many<ProductCard>(`${CARD_SELECT} where p.is_active order by p.rating_avg desc, p.sold_count desc limit 4`),
    many<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string | null;
      cta_label: string | null;
      cta_url: string | null;
      badge: string | null;
    }>(
      `select id, title, subtitle, image_url, cta_label, cta_url, badge from promotions
       where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
       order by sort_order asc limit 3`,
    ),
    many<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string | null;
      cta_label: string | null;
      cta_url: string | null;
    }>(
      `select id, title, subtitle, image_url, cta_label, cta_url from banners
       where placement = 'hero' and is_active
         and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
       order by sort_order asc limit 3`,
    ),
  ]);
  return { categories, featured, newArrivals, bestSellers, recommended, promotions, banners };
}

export async function getTopupGames() {
  return many<{
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    banner_url: string | null;
    fields: unknown;
    product_count: number;
  }>(
    `select g.id, g.slug, g.name, g.logo_url, g.banner_url, g.fields,
            (select count(*)::int from game_topup_products gp where gp.game_id = g.id and gp.is_active) as product_count
     from game_topup_games g where g.is_active order by g.sort_order asc, g.name asc`,
  );
}

export async function getTopupGameBySlug(slug: string) {
  const game = await one<{
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    banner_url: string | null;
    fields: unknown;
  }>("select id, slug, name, logo_url, banner_url, fields from game_topup_games where slug = $1 and is_active", [slug]);
  if (!game) return null;
  const products = await many<{
    id: string;
    slug: string;
    name: string;
    price: string;
    compare_at_price: string | null;
    delivery_type: string;
    provider_id: string | null;
    metadata: Record<string, unknown>;
  }>(
    `select id, slug, name, price, compare_at_price, delivery_type, provider_id, metadata
     from game_topup_products where game_id = $1 and is_active order by sort_order asc, price asc`,
    [game.id],
  );
  return { game, products };
}

export async function searchSuggestions(query: string): Promise<{
  products: { slug: string; name: string; image_url: string | null; price: string }[];
  categories: { slug: string; name: string }[];
}> {
  const q = query.trim();
  if (q.length < 2) return { products: [], categories: [] };
  const like = `%${q}%`;
  const [products, categories] = await Promise.all([
    many<{ slug: string; name: string; image_url: string | null; price: string }>(
      `select p.slug, coalesce(p.name_en, p.name_th) as name,
              (select url from product_images pi where pi.product_id = p.id order by sort_order limit 1) as image_url,
              p.price
       from products p where p.is_active and (p.name_en ilike $1 or p.name_th ilike $1) limit 6`,
      [like],
    ),
    many<{ slug: string; name: string }>(
      `select slug, coalesce(name_en, name_th) as name from categories where is_active and (name_en ilike $1 or name_th ilike $1) limit 4`,
      [like],
    ),
  ]);
  return { products, categories };
}

export async function getReviewsForProduct(productId: string) {
  return many<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    `select r.id, r.rating, r.title, r.body, r.created_at,
            coalesce(nullif(p.display_name, ''), 'Player') as display_name, p.avatar_url
     from reviews r join profiles p on p.id = r.user_id
     where r.product_id = $1 and r.status = 'approved'
     order by r.created_at desc limit 20`,
    [productId],
  );
}

export async function homepageStats() {
  const row = await one<{ products: number; orders: number; customers: number }>(
    `select
       (select count(*)::int from products where is_active) as products,
       (select count(*)::int from orders where payment_status = 'paid') as orders,
       (select count(*)::int from profiles) as customers`,
  );
  return {
    products: Number(row?.products ?? 0),
    orders: Number(row?.orders ?? 0),
    customers: Number(row?.customers ?? 0),
  };
}

export async function getLatestReviews(limit = 6) {
  return many<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
    display_name: string;
    avatar_url: string | null;
    product_name: string;
    product_slug: string;
  }>(
    `select r.id, r.rating, r.title, r.body, r.created_at, p.display_name, p.avatar_url,
            pr.name_en as product_name, pr.slug as product_slug
     from reviews r
     join profiles p on p.id = r.user_id
     join products pr on pr.id = r.product_id
     where r.status = 'approved'
     order by r.created_at desc limit $1`,
    [limit],
  );
}