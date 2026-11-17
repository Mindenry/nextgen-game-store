"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ProductVariant } from "@/lib/catalog";
import { addToCartAction } from "@/actions/cart";
import { formatMinorTHB, toMinor } from "@/lib/money";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ProductPurchase({
  productId,
  basePrice,
  baseCompare,
  stockMode,
  stockQuantity,
  availableUnits,
  variants,
}: {
  productId: string;
  basePrice: string;
  baseCompare: string | null;
  stockMode: string;
  stockQuantity: number;
  availableUnits: number;
  variants: ProductVariant[];
}) {
  const activeVariants = variants.filter((variant) => variant.is_active);
  const [variantId, setVariantId] = useState<string | null>(activeVariants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const router = useRouter();

  const variant = useMemo(
    () => activeVariants.find((item) => item.id === variantId) ?? null,
    [activeVariants, variantId],
  );

  const unitPrice = variant ? toMinor(variant.price) : toMinor(basePrice);
  const compare = variant?.compare_at_price ?? baseCompare;
  const maxStock =
    stockMode === "unlimited"
      ? 10
      : Math.min(10, variant ? Number(variant.stock_quantity) : Math.max(Number(stockQuantity), availableUnits));
  const soldOut = maxStock <= 0;

  function add(goToCart: boolean) {
    if (activeVariants.length > 0 && !variantId) {
      toast.error("Choose an option first.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("productId", productId);
      if (variantId) formData.set("variantId", variantId);
      formData.set("quantity", String(quantity));
      const result = await addToCartAction(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not add to cart");
        return;
      }
      setAdded(true);
      toast.success(result.message ?? "Added to cart");
      router.refresh();
      if (goToCart) router.push("/cart");
      else setTimeout(() => setAdded(false), 1600);
    });
  }

  return (
    <div className="space-y-5">
      {activeVariants.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Choose an option</p>
          <div className="flex flex-wrap gap-2">
            {activeVariants.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setVariantId(option.id);
                  setQuantity(1);
                }}
                className={cn(
                  "rounded-xl border px-3.5 py-2.5 text-left text-sm transition",
                  option.id === variantId
                    ? "border-primary bg-primary/8 text-fg ring-1 ring-primary/20"
                    : "border-border bg-surface text-fg-soft hover:border-border-strong",
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  {option.name_en}
                  {option.id === variantId ? <Check className="size-3.5 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {formatMinorTHB(toMinor(option.price))} · {option.stock_quantity > 0 ? `${option.stock_quantity} left` : "Out of stock"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <p className="tabular text-3xl font-semibold text-fg">{formatMinorTHB(unitPrice)}</p>
        {compare && toMinor(compare) > unitPrice ? (
          <p className="tabular pb-1 text-sm text-muted line-through">
            {formatMinorTHB(toMinor(compare))}
          </p>
        ) : null}
        {stockMode !== "unlimited" ? (
          <p className="pb-1 text-xs text-muted">{soldOut ? "Out of stock" : `${maxStock} available`}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 items-center rounded-xl border border-border bg-surface">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="grid h-full w-10 place-items-center text-muted transition hover:text-fg disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="tabular w-8 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(maxStock || 1, value + 1))}
            disabled={quantity >= maxStock}
            aria-label="Increase quantity"
            className="grid h-full w-10 place-items-center text-muted transition hover:text-fg disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <p className="tabular text-sm text-muted">
          Total <span className="font-semibold text-fg">{formatMinorTHB(unitPrice * quantity)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          onClick={() => add(false)}
          disabled={pending || soldOut}
          variant={added ? "success" : "primary"}
          className="flex-1"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : added ? (
            <Check className="size-4" />
          ) : (
            <ShoppingCart className="size-4" />
          )}
          {soldOut ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => add(true)}
          disabled={pending || soldOut}
          className="flex-1"
        >
          <Zap className="size-4 text-primary" />
          Buy now
        </Button>
      </div>
    </div>
  );
}
