import { describe, expect, it } from "vitest";
import { formatTHB, toMinor, toNumericString, computeDiscount, percentOf } from "@/lib/money";

describe("money", () => {
  it("converts decimal strings to integer satang without float drift", () => {
    expect(toMinor("1290")).toBe(129000);
    expect(toMinor("1290.5")).toBe(129050);
    expect(toMinor("0.01")).toBe(1);
    expect(toMinor("1,234.56")).toBe(123456);
    expect(toMinor(19.99)).toBe(1999);
  });

  it("rejects malformed amounts", () => {
    expect(() => toMinor("12.345")).toThrow();
    expect(() => toMinor("abc")).toThrow();
    expect(toMinor("")).toBe(0);
  });

  it("serialises back to a numeric string", () => {
    expect(toNumericString(129000)).toBe("1290.00");
    expect(toNumericString(-1050)).toBe("-10.50");
    expect(toNumericString(0)).toBe("0.00");
  });

  it("formats THB consistently", () => {
    expect(formatTHB("1290.00")).toContain("1,290.00");
    expect(formatTHB(null)).toContain("0.00");
  });

  it("applies percentage and fixed discounts with caps", () => {
    expect(percentOf(100000, 10)).toBe(10000);
    expect(computeDiscount(100000, { type: "percentage", value: "10" })).toBe(10000);
    expect(computeDiscount(100000, { type: "percentage", value: "50", maxDiscount: "200.00" })).toBe(20000);
    expect(computeDiscount(100000, { type: "fixed", value: "100" })).toBe(10000);
    expect(computeDiscount(5000, { type: "fixed", value: "100" })).toBe(5000);
  });
});
