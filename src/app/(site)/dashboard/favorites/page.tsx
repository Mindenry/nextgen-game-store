import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { getProductsByIds } from "@/lib/catalog";
import { buttonClass, EmptyState } from "@/components/ui";
import { ProductGrid } from "@/components/product-card";

export const metadata = { title: "Favourites" };

export default async function FavoritesPage() {
  const user = await requireUser("/dashboard/favorites");
  const rows = await many<{ product_id: string }>(
    "select product_id from favorites where user_id = $1 order by created_at desc",
    [user.id],
  );
  const products = await getProductsByIds(rows.map((row) => row.product_id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Saved</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold md:text-3xl">
          <Heart className="size-6 text-danger" /> Favourites
        </h1>
        <p className="mt-1 text-sm text-muted">Products you saved for later.</p>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-5" />}
          title="No favourites yet"
          description="Tap “Save for later” on any product to keep it here."
          action={<Link href="/products" className={buttonClass({ size: "sm" })}>Browse products</Link>}
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
