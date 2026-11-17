import { describe, expect, it } from "vitest";
import {
  buildPromptPayPayload,
  crc16ccitt,
  normalizePromptPayId,
  PromptPayError,
} from "@/lib/payments/promptpay";

describe("PromptPay QR payload", () => {
  it("normalises mobile, national ID and e-wallet targets", () => {
    expect(normalizePromptPayId("0812345678")).toEqual({ kind: "mobile", value: "0812345678" });
    expect(normalizePromptPayId("+66812345678")).toEqual({ kind: "mobile", value: "0812345678" });
    expect(normalizePromptPayId("1234567890123")).toEqual({ kind: "national_id", value: "1234567890123" });
    expect(normalizePromptPayId("123456789012345")).toEqual({ kind: "ewallet", value: "123456789012345" });
    expect(() => normalizePromptPayId("12345")).toThrow(PromptPayError);
  });

  it("computes a valid CRC16-CCITT trailer", () => {
    const payload = buildPromptPayPayload({
      promptPayId: "0812345678",
      amountMinor: 129900,
      reference: "NG250101ABCD1234",
    });
    const body = payload.slice(0, -4);
    const expected = crc16ccitt(body).toString(16).toUpperCase().padStart(4, "0");
    expect(payload.slice(-4)).toBe(expected);
    expect(payload).toContain("54071299.00");
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("5303764");
    expect(payload).toContain("5802TH");
    expect(payload).toContain("NG250101ABCD1234");
  });

  it("rejects zero and negative amounts", () => {
    expect(() =>
      buildPromptPayPayload({ promptPayId: "0812345678", amountMinor: 0, reference: "REF1234" }),
    ).toThrow(PromptPayError);
    expect(() =>
      buildPromptPayPayload({ promptPayId: "0812345678", amountMinor: -1, reference: "REF1234" }),
    ).toThrow(PromptPayError);
  });

  it("rejects a too-short reference", () => {
    expect(() =>
      buildPromptPayPayload({ promptPayId: "0812345678", amountMinor: 100, reference: "AB" }),
    ).toThrow(PromptPayError);
  });
});
