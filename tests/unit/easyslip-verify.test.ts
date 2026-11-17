import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/crypto";

const settings: Record<string, unknown> = {};

vi.mock("@/lib/settings", () => ({
  getSettings: async () => settings,
}));

vi.mock("@/lib/uploads", () => ({
  readUploadBytes: async () => ({ bytes: Buffer.from("fake-png"), contentType: "image/png" }),
}));

import { verifySlipImage } from "@/lib/slip-verification";

function easySlipBody(overrides?: {
  amount?: number;
  receiver?: string;
  duplicate?: boolean;
  date?: string;
}) {
  return {
    success: true,
    message: "Bank slip verified successfully",
    data: {
      isDuplicate: overrides?.duplicate ?? false,
      rawSlip: {
        transRef: "68370160657749I376388B35",
        date: overrides?.date ?? new Date().toISOString(),
        amount: { amount: overrides?.amount ?? 1 },
        sender: { bank: { short: "KBANK" }, account: { name: { th: "นาย ผู้โอน ทดสอบ" } } },
        receiver: {
          bank: { short: "SCB" },
          account: { name: { th: overrides?.receiver ?? "นาย สมชาย ใจดี" } },
        },
      },
    },
  };
}

function stubFetch(body: unknown, status = 200) {
  const mock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  Object.assign(settings, {
    "slip.enabled": true,
    "slip.provider": "easyslip",
    "slip.auto_approve": true,
    "slip.easyslip_api_key": encryptSecret("test-easyslip-key"),
    "slip.receiver_name": "สมชาย ใจดี",
    "slip.max_age_days": 30,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(settings)) delete settings[key];
});

describe("EasySlip verification pipeline", () => {
  it("verifies a real transfer when amount and receiver name match", async () => {
    const mock = stubFetch(easySlipBody());
    const result = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(result.status).toBe("verified");
    expect(result.provider).toBe("easyslip");
    expect(result.receiverName).toBe("นาย สมชาย ใจดี");

    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ checkDuplicate: true, matchAmount: 1 });
  });

  it("rejects a slip paid to a different account", async () => {
    stubFetch(easySlipBody({ receiver: "นาย สมหญิง ใจดี" }));
    const result = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(result.status).toBe("rejected");
    expect(result.message).toMatch(/different account/i);
  });

  it("rejects a reused slip and an amount mismatch", async () => {
    stubFetch(easySlipBody({ duplicate: true }));
    const duplicate = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(duplicate.status).toBe("rejected");

    stubFetch(easySlipBody({ amount: 250 }));
    const mismatch = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(mismatch.status).toBe("rejected");
  });

  it("rejects slips older than the configured maximum age", async () => {
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    stubFetch(easySlipBody({ date: old }));
    const result = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(result.status).toBe("rejected");
    expect(result.message).toMatch(/older/);
  });

  it("refuses to verify when the receiver name is not configured", async () => {
    settings["slip.receiver_name"] = "";
    const mock = stubFetch(easySlipBody());
    const result = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(result.status).toBe("not_configured");
    expect(mock).not.toHaveBeenCalled();
  });

  it("never reports verified when the provider fails", async () => {
    stubFetch({ success: false, error: { code: "SLIP_NOT_FOUND" } }, 404);
    const result = await verifySlipImage({ evidenceRef: "/api/files/slips/u/a.png", amountMinor: 100 });
    expect(result.status).toBe("rejected");
  });
});
