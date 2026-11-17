/**
 * Free, self-hosted parser for the "Mini QR" printed on Thai payment slips.
 *
 * Format references (both MIT):
 *  - https://github.com/maythiwat/promptparse (SlipVerify)
 *  - https://github.com/uunw/thai-qr-payment (slip-verify)
 *  - https://github.com/sunJirapath/promptparse-jvm (Apache-2.0, SPEC_NOTES)
 *
 * IMPORTANT: this parser proves only that the QR is structurally valid and
 * yields the bank + transaction reference. It does NOT prove the transfer
 * exists or that the amount/receiver are correct. A bank/PSP confirmation is
 * still required before crediting money.
 */
import { crc16ccitt } from "@/lib/payments/promptpay";

export type ParsedSlip =
  | {
      kind: "standard";
      sendingBank: string;
      transRef: string;
      country: string | null;
      rawLength: number;
    }
  | {
      kind: "truemoney";
      eventType: string;
      txnId: string;
      date: string;
      rawLength: number;
    };

type Tlv = { id: string; value: string; end: number };

const MAX_LENGTH = 4096;
const ASCII_ONLY = /^[\x20-\x7E]+$/;

export function parseTlv(payload: string): Tlv[] | null {
  if (!payload || payload.length > MAX_LENGTH || !ASCII_ONLY.test(payload)) return null;
  const tags: Tlv[] = [];
  let position = 0;
  while (position < payload.length) {
    if (position + 4 > payload.length) return null;
    const id = payload.slice(position, position + 2);
    const lengthText = payload.slice(position + 2, position + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) return null;
    const length = Number(lengthText);
    const start = position + 4;
    const end = start + length;
    if (end > payload.length) return null;
    tags.push({ id, value: payload.slice(start, end), end });
    position = end;
  }
  return tags.length > 0 ? tags : null;
}

function subTags(value: string): Map<string, string> | null {
  const tags = parseTlv(value);
  if (!tags) return null;
  const map = new Map<string, string>();
  for (const tag of tags) {
    if (map.has(tag.id)) return null;
    map.set(tag.id, tag.value);
  }
  return map;
}

export function slipCrcValid(payload: string): boolean {
  if (payload.length < 8) return false;
  const expected = payload.slice(-4).toUpperCase();
  const computed = crc16ccitt(payload.slice(0, -4)).toString(16).toUpperCase().padStart(4, "0");
  return expected === computed;
}

export function parseSlipPayload(payload: string): ParsedSlip | null {
  if (!payload || payload.length > MAX_LENGTH) return null;
  const tags = parseTlv(payload);
  if (!tags) return null;
  // The CRC tag must be the single final root tag and must be 4 hex chars.
  const crc = tags[tags.length - 1];
  if (tags.filter((tag) => tag.id === "91").length !== 1) return null;
  if (crc.id !== "91" || crc.value.length !== 4 || !slipCrcValid(payload)) return null;

  const root = tags.find((tag) => tag.id === "00");
  if (!root) return null;
  const fields = subTags(root.value);
  if (!fields) return null;
  const country = tags.find((tag) => tag.id === "51")?.value ?? null;
  if (country && country !== "TH") return null;

  // Standard bank slip Mini QR
  if (fields.get("00") === "000001") {
    const sendingBank = fields.get("01") ?? "";
    const transRef = fields.get("02") ?? "";
    if (!/^\d{3}$/.test(sendingBank) || transRef.length < 1 || transRef.length > 25) return null;
    return { kind: "standard", sendingBank, transRef, country, rawLength: payload.length };
  }

  // TrueMoney slip Mini QR: both markers must be "01" and all three fields present.
  if (fields.get("00") === "01" && fields.get("01") === "01") {
    const eventType = fields.get("02") ?? "";
    const txnId = fields.get("03") ?? "";
    const date = fields.get("04") ?? "";
    if (!eventType || !txnId || !/^\d{8}$/.test(date)) return null;
    return { kind: "truemoney", eventType, txnId, date, rawLength: payload.length };
  }

  return null;
}

export function slipReference(slip: ParsedSlip): string {
  return slip.kind === "standard" ? slip.transRef : slip.txnId;
}
