/** Minimal EMVCo PromptPay QR payload builder (no external service required). */
export class PromptPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptPayError";
  }
}

export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function field(tag: string, value: string): string {
  if (value.length > 99) throw new PromptPayError(`EMV field ${tag} is too long`);
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

export type PromptPayTarget =
  | { kind: "mobile"; value: string }
  | { kind: "national_id"; value: string }
  | { kind: "ewallet"; value: string };

export function normalizePromptPayId(input: string): PromptPayTarget {
  const digits = input.replace(/[^0-9]/g, "");
  if (/^0[689]\d{8}$/.test(digits)) return { kind: "mobile", value: digits };
  if (/^\+?66[689]\d{8}$/.test(input.replace(/[^0-9+]/g, ""))) {
    const local = "0" + input.replace(/[^0-9]/g, "").slice(2);
    return { kind: "mobile", value: local };
  }
  if (/^\d{13}$/.test(digits)) return { kind: "national_id", value: digits };
  if (/^\d{15}$/.test(digits)) return { kind: "ewallet", value: digits };
  throw new PromptPayError(
    "PromptPay ID must be a 10-digit mobile number, 13-digit national ID, or 15-digit e-wallet ID.",
  );
}

export function buildPromptPayPayload(input: {
  promptPayId: string;
  amountMinor: number;
  reference: string;
}): string {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new PromptPayError("Amount must be a positive number of satang.");
  }
  const target = normalizePromptPayId(input.promptPayId);
  const reference = input.reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  if (reference.length < 4) throw new PromptPayError("Payment reference is too short.");

  let merchant: string;
  if (target.kind === "mobile") {
    merchant = field("00", "A000000677010111") + field("01", "0066" + target.value.slice(1));
  } else if (target.kind === "national_id") {
    merchant = field("00", "A000000677010111") + field("02", target.value);
  } else {
    merchant = field("00", "A000000677010111") + field("03", target.value);
  }

  const amount = (input.amountMinor / 100).toFixed(2);
  let payload =
    field("00", "01") +
    field("01", "11") +
    field("29", merchant) +
    field("53", "764") +
    field("54", amount) +
    field("58", "TH") +
    field("62", field("05", reference)) +
    "6304";
  payload += crc16ccitt(payload).toString(16).toUpperCase().padStart(4, "0");
  return payload;
}

export function newPaymentReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 8; i++) random += alphabet[Math.floor(Math.random() * alphabet.length)];
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `NG${date}${random}`;
}
