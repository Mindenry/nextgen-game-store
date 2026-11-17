/** TrueMoney Angpao voucher parsing (no network calls, no redemption). */
export interface TruemoneyVoucher {
  code: string;
  url: string | null;
}

const CODE_RE = /^[A-Za-z0-9_-]{6,100}$/;

export function parseTruemoneyVoucher(input: string): TruemoneyVoucher | null {
  const value = input.trim();
  if (!value || value.length > 500) return null;

  // Raw voucher code
  if (CODE_RE.test(value)) return { code: value, url: null };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  if (url.hostname !== "gift.truemoney.com") return null;

  const candidates = [
    url.searchParams.get("v"),
    url.searchParams.get("voucher"),
    url.pathname.split("/").filter(Boolean).pop() ?? null,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const code = candidates.find((candidate) => CODE_RE.test(candidate));
  if (!code) return null;
  return { code, url: url.toString() };
}
