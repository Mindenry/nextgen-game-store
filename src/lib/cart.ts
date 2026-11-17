import "server-only";
import { cookies } from "next/headers";
import { hmacSha256, safeEqualHex } from "@/lib/crypto";
import { many } from "@/lib/db";
import { env } from "@/lib/env";
import { toMinor } from "@/lib/money";

export const CART_COOKIE = "ngs_cart";
const MAX_LINES = 20;
const MAX_QTY = 10;

export type CartLine = { productId: string; variantId: string | null; quantity: number };
type SignedCart = { items: CartLine[] };

function secret(): string {
  const value = env.cartSecret || env.encryptionKey;
  if (!value) throw new Error("CART_COOKIE_SECRET is not configured.");
  return value;
}

function sign(payload: string): string {
  return hmacSha256(payload, secret());
}

function encode(cart: SignedCart): string {
  const body = Buffer.from(JSON.stringify(cart), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(raw: string | undefined): SignedCart {
  if (!raw) return { items: [] };
  const [body, signature] = raw.split(".");
  if (!body || !signature) return { items: [] };
  if (!safeEqualHex(sign(body), signature)) return { items: [] };
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedCart;
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitize(items: CartLine[]): CartLine[] {
  return items
    .filter((i) => UUID_RE.test(i.productId))
    .slice(0, MAX_LINES)
    .map((i) => ({
      productId: i.productId,
      variantId: i.variantId && UUID_RE.test(i.variantId) ? i.variantId : null,
      quantity: Math.min(MAX_QTY, Math.max(1, Math.floor(Number(i.quantity) || 1))),
    }));
}

export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return sanitize(decode(store.get(CART_COOKIE)?.value).items);
}

export async function writeCart(items: CartLine[]): Promise<void> {
  const store = await cookies();
  if (items.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, encode({ items: sanitize(items) }), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export type DetailedCartItem = {
  line: CartLine;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  imageUrl: string | null;
  productType: string;
  deliveryMethod: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  available: number;
  issue: string | null;
};

function localeName(row: { name_th: string; name_en: string }, locale: "th" | "en") {
  return locale === "th" ? row.name_th : row.name_en;
}

export async function getDetailedCart(locale: "th" | "en" = "th"): Promise<{
  items: DetailedCartItem[];
  subtotalMinor: number;
  count: number;
  hasIssues: boolean;
}> {
  const lines = await readCart();
  if (lines.length === 0) return { items: [], subtotalMinor: 0, count: 0, hasIssues: false };

  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await many<{
    id: string;
    slug: string;
    name_th: string;
    name_en: string;
    product_type: string;
    price: string;
    stock_mode: string;
    stock_quantity: number;
    delivery_method: string;
    is_active: boolean;
    image_url: string | null;
  }>(
    `select p.id, p.slug, p.name_th, p.name_en, p.product_type, p.price, p.stock_mode,
            p.stock_quantity, p.delivery_method, p.is_active,
            (select url from product_images pi where pi.product_id = p.id order by sort_order limit 1) as image_url
     from products p where p.id = any($1::uuid[])`,
    [ids],
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  const variantIds = lines.map((l) => l.variantId).filter(Boolean) as string[];
  const variants =
    variantIds.length > 0
      ? await many<{ id: string; product_id: string; name_th: string; name_en: string; price: string; stock_quantity: number; is_active: boolean }>(
          "select id, product_id, name_th, name_en, price, stock_quantity, is_active from product_variants where id = any($1::uuid[])",
          [variantIds],
        )
      : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  let subtotal = 0;
  let count = 0;
  let hasIssues = false;

  const items: DetailedCartItem[] = lines.map((line) => {
    const product = byId.get(line.productId);
    const variant = line.variantId ? variantById.get(line.variantId) : null;
    if (!product || !product.is_active) {
      hasIssues = true;
      return {
        line,
        productId: line.productId,
        variantId: line.variantId,
        slug: product?.slug ?? "",
        name: product ? localeName(product, locale) : "Unavailable product",
        imageUrl: null,
        productType: product?.product_type ?? "digital_key",
        deliveryMethod: product?.delivery_method ?? "auto",
        unitPriceMinor: 0,
        quantity: line.quantity,
        lineTotalMinor: 0,
        available: 0,
        issue: "This product is no longer available.",
      };
    }
    if (line.variantId && (!variant || variant.product_id !== product.id || !variant.is_active)) {
      hasIssues = true;
      return {
        line,
        productId: product.id,
        variantId: line.variantId,
        slug: product.slug,
        name: localeName(product, locale),
        imageUrl: product.image_url,
        productType: product.product_type,
        deliveryMethod: product.delivery_method,
        unitPriceMinor: 0,
        quantity: line.quantity,
        lineTotalMinor: 0,
        available: 0,
        issue: "The selected option is no longer available.",
      };
    }
    const available =
      product.stock_mode === "unlimited"
        ? 999
        : variant
          ? variant.stock_quantity
          : product.stock_quantity;
    const unit = toMinor(variant?.price ?? product.price);
    const issue =
      product.product_type === "topup"
        ? "Game top-ups must be purchased from the Game Top-Up page."
        : available < line.quantity
          ? "Not enough stock for the requested quantity."
          : null;
    if (issue) hasIssues = true;
    const lineTotal = issue ? 0 : unit * line.quantity;
    subtotal += lineTotal;
    count += line.quantity;
    return {
      line,
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      name: variant ? `${localeName(product, locale)} — ${localeName(variant, locale)}` : localeName(product, locale),
      imageUrl: product.image_url,
      productType: product.product_type,
      deliveryMethod: product.delivery_method,
      unitPriceMinor: unit,
      quantity: line.quantity,
      lineTotalMinor: lineTotal,
      available,
      issue,
    };
  });

  return { items, subtotalMinor: subtotal, count, hasIssues };
}

export async function addToCart(productId: string, variantId: string | null, quantity = 1): Promise<void> {
  const items = await readCart();
  const existing = items.find((i) => i.productId === productId && i.variantId === (variantId ?? null));
  if (existing) {
    existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
  } else {
    items.push({ productId, variantId: variantId ?? null, quantity: Math.min(MAX_QTY, quantity) });
  }
  await writeCart(items);
}

export async function updateCartQuantity(productId: string, variantId: string | null, quantity: number): Promise<void> {
  const items = await readCart();
  const line = items.find((i) => i.productId === productId && i.variantId === (variantId ?? null));
  if (!line) return;
  if (quantity <= 0) {
    await writeCart(items.filter((i) => i !== line));
    return;
  }
  line.quantity = Math.min(MAX_QTY, quantity);
  await writeCart(items);
}

export async function removeFromCart(productId: string, variantId: string | null): Promise<void> {
  const items = await readCart();
  await writeCart(items.filter((i) => !(i.productId === productId && i.variantId === (variantId ?? null))));
}

export async function clearCart(): Promise<void> {
  await writeCart([]);
}

export async function cartCount(): Promise<number> {
  return (await readCart()).reduce((sum, i) => sum + i.quantity, 0);
}
