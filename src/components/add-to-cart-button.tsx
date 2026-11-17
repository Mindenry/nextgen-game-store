"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCartAction } from "@/actions/cart";
import { Button, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  productId,
  variantId = null,
  quantity = 1,
  disabled,
  className,
  label = "Add to cart",
  goToCart = false,
  size = "md",
}: {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  goToCart?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
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
      toast.success(result.message ?? "Added to cart");
      router.refresh();
      if (goToCart) router.push("/cart");
    });
  }

  return (
    <Button onClick={add} disabled={disabled || pending} size={size} className={className}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : goToCart ? <ShoppingCart className="size-4" /> : <Plus className="size-4" />}
      {pending ? "Adding…" : label}
    </Button>
  );
}

export function QuickAddLink({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("productId", productId);
          formData.set("quantity", "1");
          const result = await addToCartAction(formData);
          if (!result.ok) toast.error(result.error ?? "Could not add to cart");
          else {
            toast.success("Added to cart");
            router.refresh();
          }
        })
      }
      className={cn(buttonClass({ size: "sm", variant: "secondary" }), "w-full", className)}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      Quick add
    </button>
  );
}
