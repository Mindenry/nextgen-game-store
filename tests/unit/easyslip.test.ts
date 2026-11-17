import { describe, expect, it } from "vitest";
import { interpretEasySlipResponse } from "@/lib/slip-verify/easyslip";
import { namesMatch, normalizePersonName } from "@/lib/slip-verify/name-match";

const successBody = {
  success: true,
  message: "Bank slip verified successfully",
  data: {
    isDuplicate: false,
    isAmountMatched: true,
    rawSlip: {
      transRef: "68370160657749I376388B35",
      date: "2026-11-17T14:30:00+07:00",
      amount: { amount: 1.0 },
      sender: { bank: { short: "KBANK" }, account: { name: { th: "นาย ผู้โอน ทดสอบ" } } },
      receiver: { bank: { short: "SCB" }, account: { name: { th: "นาย สมชาย ใจดี" } } },
    },
  },
};

describe("EasySlip response mapping", () => {
  it("maps a verified slip with receiver name and amount", () => {
    const outcome = interpretEasySlipResponse(200, successBody);
    expect(outcome.status).toBe("verified");
    expect(outcome.transRef).toBe("68370160657749I376388B35");
    expect(outcome.amount).toBe(1);
    expect(outcome.receiverName).toBe("นาย สมชาย ใจดี");
    expect(outcome.receiverBank).toBe("SCB");
  });

  it("treats a duplicate slip as unusable", () => {
    const body = structuredClone(successBody);
    body.data.isDuplicate = true;
    const outcome = interpretEasySlipResponse(200, body);
    expect(outcome.status).toBe("duplicate");
    expect(outcome.duplicate).toBe(true);
  });

  it("rejects an amount mismatch reported by the provider", () => {
    const body = structuredClone(successBody);
    body.data.isAmountMatched = false;
    const outcome = interpretEasySlipResponse(200, body);
    expect(outcome.status).toBe("rejected");
    expect(outcome.code).toBe("AMOUNT_MISMATCH");
  });

  it("returns pending for Bangkok Bank slips that are not posted yet", () => {
    const outcome = interpretEasySlipResponse(404, {
      success: false,
      error: { code: "SLIP_PENDING", message: "pending" },
    });
    expect(outcome.status).toBe("pending");
  });

  it("rejects unknown slips and reports auth failures", () => {
    expect(
      interpretEasySlipResponse(404, { success: false, error: { code: "SLIP_NOT_FOUND", message: "not found" } }).status,
    ).toBe("rejected");
    expect(interpretEasySlipResponse(401, { success: false, error: { code: "UNAUTHORIZED" } }).status).toBe("error");
    expect(interpretEasySlipResponse(500, null).status).toBe("error");
  });
});

describe("receiver name matching", () => {
  it("ignores Thai/English title prefixes and spacing", () => {
    expect(normalizePersonName("นาย สมชาย ใจดี")).toBe("สมชาย ใจดี");
    expect(namesMatch("สมชาย ใจดี", "นายสมชาย ใจดี").match).toBe(true);
    expect(namesMatch("Mr. Somchai Jaidee", "SOMCHAI JAIDEE").match).toBe(true);
  });

  it("matches a company name with legal suffix differences", () => {
    expect(namesMatch("บริษัท เน็กซ์เจน เกมสโตร์ จำกัด", "เน็กซ์เจน เกมสโตร์").match).toBe(true);
  });

  it("rejects a different person with the same surname", () => {
    expect(namesMatch("สมชาย ใจดี", "สมหญิง ใจดี").match).toBe(false);
  });

  it("rejects a completely different account", () => {
    expect(namesMatch("สมชาย ใจดี", "บริษัท อื่น จำกัด").match).toBe(false);
    expect(namesMatch("", "สมชาย ใจดี").match).toBe(false);
  });
});
