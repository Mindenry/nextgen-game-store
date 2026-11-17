import "server-only";
import { randomUUID } from "node:crypto";
import { many, one, withTransaction, type Queryable } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { allocateDiscount, CouponError, validateCoupon } from "@/lib/coupons";
import { toMinor, toNumericString } from "@/lib/money";
import { applyWalletEntry, InsufficientFundsError } from "@/lib/wallet";
import { readCart } from "@/lib/cart";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { getPromptPayConfig, getSettings } from "@/lib/settings";
import { buildPromptPayPayload, newPaymentReference, PromptPayError } from "@/lib/payments/promptpay";
import { withIdempotency } from "@/lib/idempotency";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export class InsufficientStockError extends Error {
  constructor(productName: string) {
    super(`Not enough stock for ${productName}.`);
    this.name = "InsufficientStockError";
  }
}

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  payment_status: string;
  delivery_status: string;
  subtotal: string;
  discount_total: string;
  total: string;
  coupon_id: string | null;
  coupon_code: string | null;
  customer_note: string | null;
  internal_note: string | null;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  product_slug: string | null;
  product_type: string;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  subtotal: string;
  discount_total: string;
  total: string;
  delivery_method: string;
  fulfillment_status: string;
  topup_fields: Record<string, string> | null;
  metadata: Record<string, unknown>;
  delivered_at: string | null;
  delivery_payload_encrypted: string | null;
  delivery_note: string | null;
};

async function insertPaymentIntent(
  tx: Queryable,
  input: {
    userId: string;
    orderId: string | null;
    purpose: "wallet_deposit" | "order";
    amountMinor: number;
    providerId: string;
    reference: string;
    qrPayload: string | null;
    expiryMinutes: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.query(
    `insert into payments(reference, user_id, order_id, purpose, provider_id, amount, status, qr_payload, expires_at, metadata)
     values ($1,$2,$3,$4,$5,$6,'PENDING',$7, now() + make_interval(mins => $8::int), $9::jsonb)`,
    [
      input.reference,
      input.userId,
      input.orderId,
      input.purpose,
      input.providerId,
      toNumericString(input.amountMinor),
      input.qrPayload,
      input.expiryMinutes,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

/**
 * Allocates stock and delivers an order. MUST run inside the payment
 * transaction so inventory, order status and ledger commit atomically.
 */
export async function deliverOrder(tx: Queryable, orderId: string, actorId: string | null): Promise<void> {
  const order = await one<OrderRow>("select * from orders where id = $1 for update", [orderId], tx);
  if (!order) throw new CheckoutError("Order not found.");
  if (order.payment_status !== "paid") throw new CheckoutError("Order is not paid.");

  const items = await many<OrderItemRow>(
    "select * from order_items where order_id = $1 order by created_at",
    [orderId],
    tx,
  );

  let allDelivered = true;
  let anyDelivered = false;

  for (const item of items) {
    if (item.fulfillment_status === "delivered" || item.fulfillment_status === "refunded") continue;

    if (item.product_type === "topup") {
      const existing = await one<{ id: string }>(
        "select id from game_topup_orders where order_item_id = $1",
        [item.id],
        tx,
      );
      if (!existing) {
        const meta = item.metadata ?? {};
        await tx.query(
          `insert into game_topup_orders
             (order_id, order_item_id, user_id, game_product_id, game_name, package_name, player_fields, status)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,'PENDING')`,
          [
            orderId,
            item.id,
            order.user_id,
            (meta.game_product_id as string) ?? null,
            (meta.game_name as string) ?? item.product_name,
            item.product_name,
            JSON.stringify(item.topup_fields ?? {}),
          ],
        );
      }
      await tx.query(
        "update order_items set fulfillment_status = 'pending' where id = $1 and fulfillment_status = 'pending'",
        [item.id],
      );
      allDelivered = false;
      continue;
    }

    if (item.delivery_method === "auto" && item.product_id) {
      const product = await one<{ stock_mode: string; name_en: string; name_th: string }>(
        "select stock_mode, name_en, name_th from products where id = $1 for update",
        [item.product_id],
        tx,
      );
      if (!product) throw new InsufficientStockError(item.product_name);

      if (product.stock_mode !== "unlimited") {
        const inventory = await many<{ id: string }>(
          `select id from product_inventory
           where product_id = $1
             and status = 'AVAILABLE'
             and (($2::uuid is null and variant_id is null) or variant_id = $2::uuid)
           order by created_at asc
           for update skip locked
           limit $3`,
          [item.product_id, item.variant_id, item.quantity],
          tx,
        );
        if (inventory.length < item.quantity) {
          throw new InsufficientStockError(product.name_en || product.name_th);
        }
        for (const unit of inventory) {
          await tx.query(
            `update product_inventory
             set status = 'SOLD', order_item_id = $1, sold_at = now(), reserved_until = null
             where id = $2 and status = 'AVAILABLE'`,
            [item.id, unit.id],
          );
        }
        await tx.query(
          `update products set stock_quantity = greatest(0, stock_quantity - $1),
                               sold_count = sold_count + $1
           where id = $2`,
          [item.quantity, item.product_id],
        );
        if (item.variant_id) {
          await tx.query(
            `update product_variants set stock_quantity = greatest(0, stock_quantity - $1) where id = $2`,
            [item.quantity, item.variant_id],
          );
        }
      } else {
        await tx.query("update products set sold_count = sold_count + $1 where id = $2", [
          item.quantity,
          item.product_id,
        ]);
      }

      await tx.query(
        `update order_items set fulfillment_status = 'delivered', delivered_at = now(),
           delivery_note = coalesce(delivery_note, $2)
         where id = $1`,
        [item.id, product.stock_mode === "unlimited" ? "Digital item delivered — see product instructions." : null],
      );
      anyDelivered = true;
      continue;
    }

    // Manual delivery is picked up by staff in the admin dashboard.
    allDelivered = false;
  }

  const now = new Date().toISOString();
  if (allDelivered) {
    await tx.query(
      `update orders set status = 'completed', delivery_status = 'delivered', completed_at = $2, updated_at = now()
       where id = $1`,
      [orderId, now],
    );
  } else {
    await tx.query(
      `update orders set status = 'processing', delivery_status = 'processing', updated_at = now()
       where id = $1`,
      [orderId],
    );
  }

  if (anyDelivered) {
    await notify({
      userId: order.user_id,
      type: "purchase_completed",
      title: "Your order is ready",
      body: `Products from ${order.order_number} are available in My Products.`,
      link: "/dashboard/products",
    }, tx);
  } else {
    await notify({
      userId: order.user_id,
      type: "order_created",
      title: "Order received",
      body: `${order.order_number} is being prepared by our team.`,
      link: `/dashboard/orders/${order.order_number}`,
    }, tx);
  }

  if (actorId) {
    await audit({
      actorId,
      action: "order.deliver",
      entityType: "order",
      entityId: orderId,
      after: { allDelivered },
    }, tx);
  }
}

export async function createOrderFromCart(input: {
  userId: string;
  method: "wallet" | "promptpay";
  couponCode?: string;
  note?: string;
  idempotencyKey: string;
  locale: "th" | "en";
}): Promise<{
  orderNumber: string;
  paymentReference?: string;
  totalMinor: number;
  status: "paid" | "pending";
}> {
  return withIdempotency(input.idempotencyKey, "checkout", input.userId, async () => {
    const lines = await readCart();
    if (lines.length === 0) throw new CheckoutError("Your cart is empty.");
    const productIdsForImages = [...new Set(lines.map((line) => line.productId))];
    const imageRows = await many<{ product_id: string; url: string }>(
      `select distinct on (product_id) product_id, url from product_images
       where product_id = any($1::uuid[]) order by product_id, sort_order asc`,
      [productIdsForImages],
    );
    const imageMap = new Map(imageRows.map((row) => [row.product_id, row.url]));

    const settings = await getSettings();
    let promptPay: { promptPayId: string; expiryMinutes: number } | null = null;
    if (input.method === "promptpay") {
      const config = await getPromptPayConfig();
      const promptPayId = config.promptPayId || "";
      if (!promptPayId) {
        throw new PromptPayError(
          "PromptPay is not configured. Add a PromptPay ID in Admin → Settings (or PROMPTPAY_ID in the environment).",
        );
      }
      promptPay = { promptPayId, expiryMinutes: config.expiryMinutes };
    }

    const result = await withTransaction(async (tx) => {
      const productIds = [...new Set(lines.map((line) => line.productId))];
      const products = await many<{
        id: string;
        category_id: string;
        slug: string;
        name_th: string;
        name_en: string;
        product_type: string;
        price: string;
        stock_mode: string;
        stock_quantity: number;
        delivery_method: string;
        is_active: boolean;
      }>(
        `select p.id, p.category_id, p.slug, p.name_th, p.name_en, p.product_type, p.price,
                p.stock_mode, p.stock_quantity, p.delivery_method, p.is_active
         from products p where p.id = any($1::uuid[]) order by p.id`,
        [productIds],
        tx,
      );
      const byId = new Map(products.map((p) => [p.id, p]));

      const variantIds = lines.map((l) => l.variantId).filter(Boolean) as string[];
      const variants =
        variantIds.length > 0
          ? await many<{ id: string; product_id: string; name_th: string; name_en: string; price: string; stock_quantity: number; is_active: boolean }>(
              "select id, product_id, name_th, name_en, price, stock_quantity, is_active from product_variants where id = any($1::uuid[]) for update",
              [variantIds],
              tx,
            )
          : [];
      const variantById = new Map(variants.map((v) => [v.id, v]));

      type Line = {
        key: string;
        product: (typeof products)[number];
        variant: (typeof variants)[number] | null;
        quantity: number;
        unitMinor: number;
        totalMinor: number;
        name: string;
      };
      const built: Line[] = [];

      for (const line of lines) {
        const product = byId.get(line.productId);
        if (!product || !product.is_active) throw new CheckoutError("A product in your cart is unavailable.");
        if (product.product_type === "topup") throw new CheckoutError("Use the Game Top-Up page for top-ups.");
        const variant = (line.variantId ? variantById.get(line.variantId) : null) ?? null;
        if (line.variantId && (!variant || variant.product_id !== product.id || !variant.is_active)) {
          throw new CheckoutError("A selected variant is no longer available.");
        }
        const available = product.stock_mode === "unlimited" ? 999 : variant ? variant.stock_quantity : product.stock_quantity;
        if (available < line.quantity) throw new InsufficientStockError(product.name_en || product.name_th);
        const unitMinor = toMinor(variant?.price ?? product.price);
        const name =
          (input.locale === "th" ? product.name_th : product.name_en) +
          (variant ? ` — ${input.locale === "th" ? variant.name_th : variant.name_en}` : "");
        built.push({
          key: `${product.id}:${variant?.id ?? "base"}`,
          product,
          variant,
          quantity: line.quantity,
          unitMinor,
          totalMinor: unitMinor * line.quantity,
          name,
        });
      }

      const subtotalMinor = built.reduce((sum, l) => sum + l.totalMinor, 0);
      let discountMinor = 0;
      let coupon: Awaited<ReturnType<typeof validateCoupon>>["coupon"] | null = null;
      if (input.couponCode?.trim()) {
        const validated = await validateCoupon({
          code: input.couponCode,
          userId: input.userId,
          subtotalMinor,
          tx,
          lines: built.map((l) => ({
            productId: l.product.id,
            categoryId: l.product.category_id,
            lineTotalMinor: l.totalMinor,
          })),
        });
        coupon = validated.coupon;
        discountMinor = validated.discountMinor;
      }
      const totalMinor = Math.max(0, subtotalMinor - discountMinor);
      const allocation = allocateDiscount(
        built.map((l) => ({ key: l.key, totalMinor: l.totalMinor })),
        discountMinor,
      );

      const numberRow = await one<{ n: string }>("select next_order_number() as n", [], tx);
      const orderNumber = numberRow!.n;
      const order = await one<{ id: string }>(
        `insert into orders(order_number, user_id, status, payment_status, delivery_status, subtotal,
                            discount_total, total, coupon_id, coupon_code, payment_method, customer_note)
         values ($1,$2,'pending_payment','unpaid','pending',$3,$4,$5,$6,$7,$8,$9)
         returning id`,
        [
          orderNumber,
          input.userId,
          toNumericString(subtotalMinor),
          toNumericString(discountMinor),
          toNumericString(totalMinor),
          coupon?.id ?? null,
          coupon?.code ?? null,
          input.method === "wallet" ? "wallet" : "promptpay",
          input.note?.slice(0, 500) ?? null,
        ],
        tx,
      );
      const orderId = order!.id;

      for (const line of built) {
        const lineDiscount = allocation.get(line.key) ?? 0;
        await tx.query(
          `insert into order_items(order_id, product_id, variant_id, product_name, product_slug, product_type,
             image_url, unit_price, quantity, subtotal, discount_total, total, delivery_method, fulfillment_status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')`,
          [
            orderId,
            line.product.id,
            line.variant?.id ?? null,
            line.name,
            line.product.slug,
            line.product.product_type,
            imageMap.get(line.product.id) ?? null,
            toNumericString(line.unitMinor),
            line.quantity,
            toNumericString(line.totalMinor),
            toNumericString(lineDiscount),
            toNumericString(line.totalMinor - lineDiscount),
            line.product.delivery_method,
          ]
        );
      }

      if (coupon) {
        await tx.query(
          `insert into coupon_redemptions(coupon_id, user_id, order_id, discount_amount)
           values ($1,$2,$3,$4)`,
          [coupon.id, input.userId, orderId, toNumericString(discountMinor)]
        );
        await tx.query("update coupons set used_count = used_count + 1 where id = $1", [coupon.id],);
      }

      await notify({
        userId: input.userId,
        type: "order_created",
        title: "Order created",
        body: `Order ${orderNumber} has been created.`,
        link: `/dashboard/orders/${orderNumber}`,
      }, tx);

      if (input.method === "wallet" || totalMinor === 0) {
        if (totalMinor > 0) {
          await applyWalletEntry(tx, {
            userId: input.userId,
            amountMinor: -totalMinor,
            type: "purchase",
            description: `Payment for order ${orderNumber}`,
            orderId,
          });
        }
        await tx.query(
          `update orders set payment_status = 'paid', status = 'paid', paid_at = now(),
             payment_method = coalesce($2, payment_method), updated_at = now()
           where id = $1`,
          [orderId, totalMinor === 0 ? "coupon" : "wallet"]
        );
        await notify({
          userId: input.userId,
          type: "payment_received",
          title: "Payment received",
          body: `Payment for ${orderNumber} was completed.`,
          link: `/dashboard/orders/${orderNumber}`,
        }, tx);
        await deliverOrder(tx, orderId, null);
        return { orderNumber, totalMinor, status: "paid" as const };
      }

      const reference = newPaymentReference();
      const qrPayload = buildPromptPayPayload({
        promptPayId: promptPay!.promptPayId,
        amountMinor: totalMinor,
        reference,
      });
      await insertPaymentIntent(tx, {
        userId: input.userId,
        orderId,
        purpose: "order",
        amountMinor: totalMinor,
        providerId: String(settings["payment.active_provider"] ?? "promptpay_qr"),
        reference,
        qrPayload,
        expiryMinutes: promptPay!.expiryMinutes,
        metadata: { order_number: orderNumber },
      });
      return { orderNumber, paymentReference: reference, totalMinor, status: "pending" as const };
    });

    return result;
  });
}

export async function createTopupOrder(input: {
  userId: string;
  gameSlug: string;
  productId: string;
  fields: Record<string, string>;
  method: "wallet" | "promptpay";
  idempotencyKey: string;
}): Promise<{ orderNumber: string; paymentReference?: string; totalMinor: number }> {
  return withIdempotency(input.idempotencyKey, "topup-checkout", input.userId, async () => {
    const game = await one<{
      id: string;
      slug: string;
      name: string;
      fields: { key: string; label: string; required?: boolean; pattern?: string }[];
    }>("select id, slug, name, fields from game_topup_games where slug = $1 and is_active", [input.gameSlug]);
    if (!game) throw new CheckoutError("Game not found.");
    const product = await one<{
      id: string;
      name: string;
      price: string;
      delivery_type: string;
      provider_id: string | null;
      game_id: string;
    }>(
      "select id, name, price, delivery_type, provider_id, game_id from game_topup_products where id = $1 and game_id = $2 and is_active",
      [input.productId, game.id],
    );
    if (!product) throw new CheckoutError("Top-up package not found.");

    const fields = game.fields ?? [];
    const cleaned: Record<string, string> = {};
    for (const field of fields) {
      const raw = String(input.fields[field.key] ?? "").trim();
      if (!raw && field.required !== false) {
        throw new CheckoutError(`${field.label} is required.`);
      }
      if (raw && field.pattern && !new RegExp(field.pattern).test(raw)) {
        throw new CheckoutError(`${field.label} has an invalid format.`);
      }
      cleaned[field.key] = raw.slice(0, 120);
    }
    if (Object.keys(cleaned).length === 0) throw new CheckoutError("This game has no player fields configured.");

    const settings = await getSettings();
    let promptPay: { promptPayId: string; expiryMinutes: number } | null = null;
    if (input.method === "promptpay") {
      const config = await getPromptPayConfig();
      if (!config.promptPayId) {
        throw new PromptPayError(
          "PromptPay is not configured. Add a PromptPay ID in Admin → Settings before taking payments.",
        );
      }
      promptPay = { promptPayId: config.promptPayId, expiryMinutes: config.expiryMinutes };
    }

    return withTransaction(async (tx) => {
      const totalMinor = toMinor(product.price);
      const numberRow = await one<{ n: string }>("select next_order_number() as n", [], tx);
      const orderNumber = numberRow!.n;
      const order = await one<{ id: string }>(
        `insert into orders(order_number, user_id, status, payment_status, delivery_status, subtotal,
                            discount_total, total, payment_method)
         values ($1,$2,'pending_payment','unpaid','pending',$3,0,$3,$4) returning id`,
        [orderNumber, input.userId, toNumericString(totalMinor), input.method === "wallet" ? "wallet" : "promptpay"],
        tx,
      );
      const orderId = order!.id;
      const item = await one<{ id: string }>(
        `insert into order_items(order_id, product_id, product_name, product_type, unit_price, quantity,
           subtotal, discount_total, total, delivery_method, fulfillment_status, topup_fields, metadata)
         values ($1, null, $2, 'topup', $3, 1, $3, 0, $3, 'manual', 'pending', $4::jsonb, $5::jsonb)
         returning id`,
        [
          orderId,
          `${game.name} — ${product.name}`,
          toNumericString(totalMinor),
          JSON.stringify(cleaned),
          JSON.stringify({
            game_slug: game.slug,
            game_id: game.id,
            game_name: game.name,
            game_product_id: product.id,
            package_name: product.name,
            provider_id: product.provider_id,
          }),
        ],
        tx,
      );

      await notify({
        userId: input.userId,
        type: "order_created",
        title: "Top-up order created",
        body: `${orderNumber} — ${game.name} ${product.name}`,
        link: `/dashboard/orders/${orderNumber}`,
      }, tx);

      if (input.method === "wallet") {
        await applyWalletEntry(tx, {
          userId: input.userId,
          amountMinor: -totalMinor,
          type: "purchase",
          description: `Top-up order ${orderNumber}`,
          orderId,
        });
        await tx.query(
          "update orders set payment_status = 'paid', status = 'paid', paid_at = now() where id = $1",
          [orderId],
        );
        await deliverOrder(tx, orderId, null);
        return { orderNumber, totalMinor };
      }

      const reference = newPaymentReference();
      const qrPayload = buildPromptPayPayload({
        promptPayId: promptPay!.promptPayId,
        amountMinor: totalMinor,
        reference,
      });
      await insertPaymentIntent(tx, {
        userId: input.userId,
        orderId,
        purpose: "order",
        amountMinor: totalMinor,
        providerId: String(settings["payment.active_provider"] ?? "promptpay_qr"),
        reference,
        qrPayload,
        expiryMinutes: promptPay!.expiryMinutes,
        metadata: { order_number: orderNumber, topup: true, order_item_id: item!.id },
      });
      return { orderNumber, paymentReference: reference, totalMinor };
    });
  });
}

export async function refundOrder(
  orderId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    const order = await one<OrderRow>("select * from orders where id = $1 for update", [orderId], tx);
    if (!order) throw new CheckoutError("Order not found.");
    if (order.payment_status !== "paid") throw new CheckoutError("Only paid orders can be refunded.");
    if (order.status === "refunded") throw new CheckoutError("This order has already been refunded.");

    await applyWalletEntry(tx, {
      userId: order.user_id,
      amountMinor: toMinor(order.total),
      type: "refund",
      description: `Refund for order ${order.order_number}`,
      orderId,
      adminId,
      metadata: { reason },
    });
    await tx.query(
      `update orders set status = 'refunded', payment_status = 'refunded', updated_at = now() where id = $1`,
      [orderId]
    );
    await tx.query(
      `update order_items set fulfillment_status = 'refunded' where order_id = $1 and fulfillment_status <> 'delivered'`,
      [orderId]
    );
    await tx.query(
      `update payments set status = 'REFUNDED', updated_at = now() where order_id = $1 and status = 'PAID'`,
      [orderId]
    );
    await tx.query(
      `update game_topup_orders set status = 'REFUNDED', updated_at = now() where order_id = $1 and status <> 'COMPLETED'`,
      [orderId]
    );
    await notify({
      userId: order.user_id,
      type: "refund_completed",
      title: "Refund completed",
      body: `Order ${order.order_number} was refunded to your wallet.`,
      link: "/dashboard/wallet",
    }, tx);
    await audit({
      actorId: adminId,
      action: "order.refund",
      entityType: "order",
      entityId: orderId,
      before: { status: order.status, total: order.total },
      after: { status: "refunded", reason },
    }, tx);
  });
}

export async function getOrderByNumber(orderNumber: string) {
  const order = await one<OrderRow & { email: string; display_name: string }>(
    `select o.*, p.email, p.display_name from orders o join profiles p on p.id = o.user_id
     where o.order_number = $1`,
    [orderNumber],
  );
  if (!order) return null;
  const items = await many<OrderItemRow>("select * from order_items where order_id = $1 order by created_at", [order.id]);
  const payment = await one<{ reference: string; status: string; expires_at: string; qr_payload: string | null }>(
    "select reference, status, expires_at, qr_payload from payments where order_id = $1 order by created_at desc limit 1",
    [order.id],
  );
  const topups = await many<{ order_item_id: string; status: string; failure_reason: string | null; player_fields: Record<string, string> | null }>(
    "select order_item_id, status, failure_reason, player_fields from game_topup_orders where order_id = $1",
    [order.id],
  );
  return { order, items, payment, topups };
}

export async function listUserOrders(userId: string, limit = 50) {
  return many<OrderRow & { item_count: number; first_image: string | null }>(
    `select o.*,
            (select coalesce(sum(quantity),0)::int from order_items oi where oi.order_id = o.id) as item_count,
            (select image_url from order_items oi where oi.order_id = o.id and image_url is not null limit 1) as first_image
     from orders o where o.user_id = $1 order by o.created_at desc limit $2`,
    [userId, limit],
  );
}

export type UserProduct = {
  kind: "inventory" | "manual" | "topup";
  id: string;
  orderNumber: string;
  productName: string;
  imageUrl: string | null;
  deliveredAt: string | null;
  status: string;
  payload: Record<string, string> | null;
  note: string | null;
};

function parsePayload(encrypted: string | null): Record<string, string> | null {
  if (!encrypted) return null;
  try {
    return JSON.parse(decryptSecret(encrypted)) as Record<string, string>;
  } catch (error) {
    console.error("[delivery] failed to decrypt payload", error);
    return null;
  }
}

export async function listUserProducts(userId: string): Promise<UserProduct[]> {
  const inventory = await many<{
    id: string;
    order_number: string;
    product_name: string;
    image_url: string | null;
    sold_at: string | null;
    encrypted_payload: string;
  }>(
    `select pi.id, o.order_number, oi.product_name, oi.image_url, pi.sold_at, pi.encrypted_payload
     from product_inventory pi
     join order_items oi on oi.id = pi.order_item_id
     join orders o on o.id = oi.order_id
     where o.user_id = $1 and pi.status = 'SOLD' and o.payment_status = 'paid'
     order by pi.sold_at desc`,
    [userId],
  );

  const manual = await many<{
    id: string;
    order_number: string;
    product_name: string;
    image_url: string | null;
    delivered_at: string | null;
    delivery_payload_encrypted: string | null;
    delivery_note: string | null;
    fulfillment_status: string;
  }>(
    `select oi.id, o.order_number, oi.product_name, oi.image_url, oi.delivered_at,
            oi.delivery_payload_encrypted, oi.delivery_note, oi.fulfillment_status
     from order_items oi join orders o on o.id = oi.order_id
     where o.user_id = $1 and o.payment_status = 'paid' and oi.delivery_method = 'manual'
       and oi.product_type <> 'topup' and oi.fulfillment_status in ('delivered','reserved','pending')
     order by oi.created_at desc`,
    [userId],
  );

  const topups = await many<{
    id: string;
    order_number: string;
    product_name: string;
    image_url: string | null;
    processed_at: string | null;
    status: string;
    player_fields: Record<string, string>;
    failure_reason: string | null;
  }>(
    `select gt.id, o.order_number, oi.product_name, oi.image_url, gt.processed_at, gt.status,
            gt.player_fields, gt.failure_reason
     from game_topup_orders gt
     join order_items oi on oi.id = gt.order_item_id
     join orders o on o.id = gt.order_id
     where gt.user_id = $1 and gt.status in ('COMPLETED','PROCESSING','PENDING','MANUAL_REVIEW','FAILED')
     order by gt.created_at desc`,
    [userId],
  );

  return [
    ...inventory.map((row) => ({
      kind: "inventory" as const,
      id: row.id,
      orderNumber: row.order_number,
      productName: row.product_name,
      imageUrl: row.image_url,
      deliveredAt: row.sold_at,
      status: "delivered",
      payload: parsePayload(row.encrypted_payload),
      note: null,
    })),
    ...manual.map((row) => ({
      kind: "manual" as const,
      id: row.id,
      orderNumber: row.order_number,
      productName: row.product_name,
      imageUrl: row.image_url,
      deliveredAt: row.delivered_at,
      status: row.fulfillment_status,
      payload: parsePayload(row.delivery_payload_encrypted),
      note: row.delivery_note,
    })),
    ...topups.map((row) => ({
      kind: "topup" as const,
      id: row.id,
      orderNumber: row.order_number,
      productName: row.product_name,
      imageUrl: row.image_url,
      deliveredAt: row.processed_at,
      status: row.status.toLowerCase(),
      payload: row.player_fields ?? null,
      note: row.failure_reason,
    })),
  ];
}

export async function setManualDelivery(input: {
  orderItemId: string;
  adminId: string;
  payload?: Record<string, string>;
  note?: string;
  complete: boolean;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const item = await one<OrderItemRow & { order_id: string }>(
      "select * from order_items where id = $1 for update",
      [input.orderItemId],
      tx,
    );
    if (!item) throw new CheckoutError("Order item not found.");
    const order = await one<OrderRow>("select * from orders where id = $1 for update", [item.order_id], tx);
    if (!order) throw new CheckoutError("Order not found.");
    if (order.payment_status !== "paid") throw new CheckoutError("The order is not paid yet.");

    const encrypted = input.payload ? encryptSecret(JSON.stringify(input.payload)) : null;
    await tx.query(
      `update order_items set delivery_payload_encrypted = coalesce($2, delivery_payload_encrypted),
         delivery_note = coalesce($3, delivery_note),
         fulfillment_status = case when $4 then 'delivered' else fulfillment_status end,
         delivered_at = case when $4 then now() else delivered_at end,
         delivered_by = $5
       where id = $1`,
      [item.id, encrypted, input.note ?? null, input.complete, input.adminId]
    );

    const remaining = await one<{ count: number }>(
      `select count(*)::int as count from order_items where order_id = $1
         and fulfillment_status not in ('delivered','refunded')`,
      [order.id],
      tx,
    );
    const allDone = Number(remaining?.count ?? 0) === 0;
    await tx.query(
      `update orders set delivery_status = $2, status = $3,
         completed_at = case when $2 = 'delivered' then now() else completed_at end, updated_at = now()
       where id = $1`,
      [order.id, allDone ? "delivered" : "processing", allDone ? "completed" : "processing"]
    );
    await notify({
      userId: order.user_id,
      type: "purchase_completed",
      title: allDone ? "Order delivered" : "Order updated",
      body: `Your order ${order.order_number} has been updated.`,
      link: "/dashboard/products",
    }, tx);
    await audit({
      actorId: input.adminId,
      action: "order_item.manual_delivery",
      entityType: "order_item",
      entityId: item.id,
      after: { complete: input.complete, note: input.note ?? null },
    }, tx);
  });
}
