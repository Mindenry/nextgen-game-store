/**
 * Money helpers. All arithmetic happens on integer minor units (satang) to
 * avoid floating point drift. Values are persisted as NUMERIC(12,2).
 */
export type Minor = number;

const AMOUNT_RE = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

export function isValidAmount(value: string | number): boolean {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  return AMOUNT_RE.test(s) && Number(s) > 0;
}

/** "1,234.50" -> 123450 */
export function toMinor(value: string | number | null | undefined): Minor {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid amount");
    return Math.round(value * 100);
  }
  const normalized = value.replace(/,/g, "").trim();
  const match = /^-?(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`Invalid amount: ${value}`);
  const sign = normalized.startsWith("-") ? -1 : 1;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? "").padEnd(2, "0") || "0");
  return sign * (whole * 100 + frac);
}

/** 123450 -> "1234.50" (DB numeric literal) */
export function toNumericString(minor: Minor): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 123450 -> "฿1,234.50" (input in satang) */
export function formatMinorTHB(minor: Minor, opts: { compact?: boolean } = {}): string {
  return formatTHB(minor / 100, opts);
}

/** Format a baht value such as a NUMERIC(12,2) column returned as a string. */
export function formatTHB(
  baht: number | string | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  const value = typeof baht === "string" ? Number(baht) : (baht ?? 0);
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function percentOf(minor: Minor, percent: number): Minor {
  return Math.round((minor * percent) / 100);
}

export function clampDiscount(discount: Minor, subtotal: Minor): Minor {
  return Math.max(0, Math.min(discount, subtotal));
}

export function computeDiscount(
  subtotal: Minor,
  coupon: { type: "percentage" | "fixed"; value: string | number; maxDiscount?: string | null },
): Minor {
  const raw =
    coupon.type === "percentage"
      ? percentOf(subtotal, Number(coupon.value))
      : toMinor(String(coupon.value));
  const max = coupon.maxDiscount ? toMinor(String(coupon.maxDiscount)) : null;
  const capped = max !== null ? Math.min(raw, max) : raw;
  return clampDiscount(capped, subtotal);
}
