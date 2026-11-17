import { describe, expect, it } from "vitest";
import { allocateDiscount, calculateCouponDiscount, type CouponLine, type CouponRow } from "@/lib/coupons";

const coupon = {
  id: "c1",
  code: "TEST10",
  description: null,
  type: "percentage",
  value: "10.00",
  min_order: "0.00",
  max_discount: null,
  starts_at: null,
  expires_at: null,
  usage_limit: null,
  per_user_limit: 1,
  used_count: 0,
  applies_to: {},
  first_purchase_only: false,
  is_active: true,
} satisfies CouponRow;

describe("coupons", () => {
  it("computes a percentage discount across eligible lines", () => {
    const lines: CouponLine[] = [
      { productId: "p1", categoryId: "cat1", lineTotalMinor: 100000 },
      { productId: "p2", categoryId: "cat2", lineTotalMinor: 50000 },
    ];
    const result = calculateCouponDiscount(coupon, lines, 150000);
    expect(result.discountMinor).toBe(15000);
  });

  it("restricts to selected products", () => {
    const restricted: CouponRow = {
      ...coupon,
      applies_to: { product_ids: ["p1"] },
    };
    const lines: CouponLine[] = [
      { productId: "p1", categoryId: "cat1", lineTotalMinor: 100000 },
      { productId: "p2", categoryId: "cat2", lineTotalMinor: 900000 },
    ];
    expect(calculateCouponDiscount(restricted, lines, 1000000).discountMinor).toBe(10000);
  });

  it("returns zero when nothing is eligible", () => {
    const restricted: CouponRow = { ...coupon, applies_to: { category_ids: ["missing"] } };
    const lines: CouponLine[] = [{ productId: "p1", categoryId: "cat1", lineTotalMinor: 5000 }];
    expect(calculateCouponDiscount(restricted, lines, 5000).discountMinor).toBe(0);
  });

  it("allocates every satang of a discount exactly once", () => {
    const lines = [
      { key: "a", totalMinor: 3333 },
      { key: "b", totalMinor: 3333 },
      { key: "c", totalMinor: 3334 },
    ];
    const allocated = allocateDiscount(lines, 1000);
    const sum = [...allocated.values()].reduce((total, value) => total + value, 0);
    expect(sum).toBe(1000);
    expect(allocated.get("a")).toBeGreaterThanOrEqual(333);
  });
});
