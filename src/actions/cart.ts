"use server";

import { revalidatePath } from "next/cache";
import { addToCart, clearCart, removeFromCart, updateCartQuantity } from "@/lib/cart";
import { one } from "@/lib/db";
import { z } from "zod";

const uuid = z.string().uuid();

export type CartActionResult = { ok: boolean; error?: string; message?: string };

export async function addToCartAction(formData: FormData): Promise<CartActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const variantIdRaw = String(formData.get("variantId") ?? "");
  const quantity = Math.floor(Number(formData.get("quantity") ?? 1));
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Invalid product." };
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return { ok: false, error: "Quantity must be between 1 and 10." };
  }
  const variantId = variantIdRaw && uuid.safeParse(variantIdRaw).success ? variantIdRaw : null;

  const product = await one<{
    id: string;
    product_type: string;
    is_active: boolean;
    stock_mode: string;
    stock_quantity: number;
  }>("select id, product_type, is_active, stock_mode, stock_quantity from products where id = $1", [productId]);
  if (!product || !product.is_active) return { ok: false, error: "This product is unavailable." };
  if (product.product_type === "topup") {
    return { ok: false, error: "Use the Game Top-Up page to buy top-ups." };
  }
  if (variantId) {
    const variant = await one<{ id: string; stock_quantity: number; is_active: boolean }>(
      "select id, stock_quantity, is_active from product_variants where id = $1 and product_id = $2",
      [variantId, productId],
    );
    if (!variant || !variant.is_active) return { ok: false, error: "That option is unavailable." };
    if (variant.stock_quantity < quantity) return { ok: false, error: "Not enough stock." };
  } else if (product.stock_mode !== "unlimited" && product.stock_quantity < quantity) {
    return { ok: false, error: "Not enough stock." };
  }

  await addToCart(productId, variantId, quantity);
  revalidatePath("/cart");
  return { ok: true, message: "Added to cart." };
}

export async function updateCartAction(formData: FormData): Promise<CartActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const variantIdRaw = String(formData.get("variantId") ?? "");
  const quantity = Math.floor(Number(formData.get("quantity") ?? 1));
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Invalid product." };
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 10) {
    return { ok: false, error: "Quantity must be between 1 and 10." };
  }
  await updateCartQuantity(
    productId,
    variantIdRaw && uuid.safeParse(variantIdRaw).success ? variantIdRaw : null,
    quantity,
  );
  revalidatePath("/cart");
  return { ok: true };
}

export async function removeCartAction(formData: FormData): Promise<CartActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const variantIdRaw = String(formData.get("variantId") ?? "");
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Invalid product." };
  await removeFromCart(
    productId,
    variantIdRaw && uuid.safeParse(variantIdRaw).success ? variantIdRaw : null,
  );
  revalidatePath("/cart");
  return { ok: true, message: "Removed from cart." };
}

export async function clearCartAction(): Promise<CartActionResult> {
  await clearCart();
  revalidatePath("/cart");
  return { ok: true };
}
