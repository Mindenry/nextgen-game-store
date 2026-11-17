/** Shared product projection used by storefront queries. */
export const CARD_COLUMNS = `
  p.id, p.slug, p.name_th, p.name_en, p.short_description, p.product_type,
  p.price, p.compare_at_price, p.stock_quantity, p.stock_mode, p.sold_count,
  p.badge, p.is_featured, p.delivery_method, p.delivery_time,
  p.rating_avg, p.rating_count, p.created_at, p.metadata,
  c.slug as category_slug, c.name_th as category_name_th, c.name_en as category_name_en,
  c.icon as category_icon,
  (select url from product_images pi where pi.product_id = p.id order by sort_order asc limit 1) as image_url
`;
