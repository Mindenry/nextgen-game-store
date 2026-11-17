import "server-only";
import type { Queryable } from "@/lib/db";
import { one } from "@/lib/db";
import { computeDiscount, toMinor } from "@/lib/money";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: string;
  min_order: string;
  max_discount: string | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  applies_to: { product_ids?: string[]; category_ids?: string[] };
  first_purchase_only: boolean;
  is_active: boolean;
};

export type CouponLine = {
  productId: string;
  categoryId: string;
  lineTotalMinor: number;
};

export class CouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponError";
  }
}

export function calculateCouponDiscount(
  coupon: CouponRow,
  lines: CouponLine[],
  subtotalMinor: number,
): { discountMinor: number; eligibleSubtotalMinor: number } {
  const productIds = new Set(coupon.applies_to?.product_ids ?? []);
  const categoryIds = new Set(coupon.applies_to?.category_ids ?? []);
  const restricted = productIds.size > 0 || categoryIds.size > 0;
  const eligible = restricted
    ? lines
        .filter((l) => productIds.has(l.productId) || categoryIds.has(l.categoryId))
        .reduce((sum, l) => sum + l.lineTotalMinor, 0)
    : subtotalMinor;
  if (eligible <= 0) return { discountMinor: 0, eligibleSubtotalMinor: 0 };
  const discount = computeDiscount(eligible, {
    type: coupon.type,
    value: coupon.value,
    maxDiscount: coupon.max_discount,
  });
  return { discountMinor: discount, eligibleSubtotalMinor: eligible };
}

export async function validateCoupon(args: {
  code: string;
  userId: string;
  lines: CouponLine[];
  subtotalMinor: number;
  tx?: Queryable;
}): Promise<{ coupon: CouponRow; discountMinor: number }> {
  const code = args.code.trim().toUpperCase();
  if (!code) throw new CouponError("Enter a coupon code.");
  if (!args.tx) throw new Error("Coupon validation requires a transaction");

  const coupon = await one<CouponRow>(
    `select * from coupons where upper(code) = $1 and is_active for update`,
    [code],
    args.tx,
  );
  if (!coupon) throw new CouponError("This coupon is not valid.");
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    throw new CouponError("This coupon is not active yet.");
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    throw new CouponError("This coupon has expired.");
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    throw new CouponError("This coupon has reached its usage limit.");
  }
  if (args.subtotalMinor < toMinor(coupon.min_order)) {
    throw new CouponError(`Minimum order for this coupon is ฿${Number(coupon.min_order).toFixed(2)}.`);
  }

  const perUser = await one<{ count: number }>(
    "select count(*)::int as count from coupon_redemptions where coupon_id = $1 and user_id = $2",
    [coupon.id, args.userId],
    args.tx,
  );
  if (Number(perUser?.count ?? 0) >= coupon.per_user_limit) {
    throw new CouponError("You have already used this coupon.");
  }

  if (coupon.first_purchase_only) {
    const purchases = await one<{ count: number }>(
      "select count(*)::int as count from orders where user_id = $1 and payment_status = 'paid'",
      [args.userId],
      args.tx,
    );
    if (Number(purchases?.count ?? 0) > 0) {
      throw new CouponError("This coupon is only valid for a first purchase.");
    }
  }

  const { discountMinor } = calculateCouponDiscount(coupon, args.lines, args.subtotalMinor);
  if (discountMinor <= 0) throw new CouponError("This coupon does not apply to your cart.");
  return { coupon, discountMinor };
}

/** Split an order-level discount across lines using largest remainder. */
export function allocateDiscount(
  lines: { key: string; totalMinor: number }[],
  discountMinor: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const subtotal = lines.reduce((sum, l) => sum + l.totalMinor, 0);
  if (subtotal <= 0 || discountMinor <= 0) {
    for (const l of lines) result.set(l.key, 0);
    return result;
  }
  let allocated = 0;
  const remainders: { key: string; remainder: number }[] = [];
  for (const line of lines) {
    const exact = (discountMinor * line.totalMinor) / subtotal;
    const floor = Math.floor(exact);
    result.set(line.key, floor);
    allocated += floor;
    remainders.push({ key: line.key, remainder: exact - floor });
  }
  remainders.sort((a, b) => b.remainder - a.remainder);
  let leftover = discountMinor - allocated;
  let index = 0;
  while (leftover > 0 && remainders.length > 0) {
    const target = remainders[index % remainders.length];
    const current = result.get(target.key) ?? 0;
    result.set(target.key, current + 1);
    leftover--;
    index++;
  }
  return result;
}
