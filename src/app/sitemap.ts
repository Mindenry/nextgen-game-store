import type { MetadataRoute } from "next";
import { many } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const [products, categories] = await Promise.all([
    many<{ slug: string; updated_at: string }>("select slug, updated_at from products where is_active"),
    many<{ slug: string; updated_at: string }>("select slug, updated_at from categories where is_active"),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/topup`, changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: new Date(category.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
