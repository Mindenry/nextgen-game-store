"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeCartAction, updateCartAction } from "@/actions/cart";

export function CartLineControls({
  productId,
  variantId,
  quantity,
  max,
}: {
  productId: string;
  variantId: string | null;
  quantity: number;
  max: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(next: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("productId", productId);
      if (variantId) formData.set("variantId", variantId);
      formData.set("quantity", String(next));
      const result = await updateCartAction(formData);
      if (!result.ok) toast.error(result.error ?? "Could not update the cart");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("productId", productId);
      if (variantId) formData.set("variantId", variantId);
      await removeCartAction(formData);
      toast.success("Removed from cart");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 items-center rounded-lg border border-border bg-surface">
        <button
          type="button"
          onClick={() => update(quantity - 1)}
          disabled={pending}
          aria-label="Decrease quantity"
          className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-40"
        >
          <Minus className="size-3" />
        </button>
        <span className="tabular w-6 text-center text-xs font-semibold">{quantity}</span>
        <button
          type="button"
          onClick={() => update(quantity + 1)}
          disabled={pending || quantity >= Math.min(max, 10)}
          aria-label="Increase quantity"
          className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-40"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="Remove item"
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger/8 hover:text-danger"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}
