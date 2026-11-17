import { describe, expect, it } from "vitest";
import { parseSlipPayload, parseTlv, slipCrcValid } from "@/lib/slip-payload";

// Golden vectors cross-checked against maythiwat/promptparse and
// uunw/thai-qr-payment (both MIT) via the promptparse-jvm SPEC_NOTES.
const STANDARD_SLIP = "004000060000010103002021900021231231212000115102TH91049C30";
const TRUEMONEY_SLIP = "00480002010102010203P2P0313TXN00012345670408250120249104b425";

describe("slip Mini QR parser (self-hosted)", () => {
  it("parses a standard bank slip and its transaction reference", () => {
    const slip = parseSlipPayload(STANDARD_SLIP);
    expect(slip).not.toBeNull();
    expect(slip?.kind).toBe("standard");
    if (slip?.kind === "standard") {
      expect(slip.sendingBank).toBe("002");
      expect(slip.transRef).toBe("0002123123121200011");
      expect(slip.country).toBe("TH");
    }
  });

  it("parses a TrueMoney slip", () => {
    const slip = parseSlipPayload(TRUEMONEY_SLIP);
    expect(slip).not.toBeNull();
    expect(slip?.kind).toBe("truemoney");
    if (slip?.kind === "truemoney") {
      expect(slip.eventType).toBe("P2P");
      expect(slip.txnId).toBe("TXN0001234567");
      expect(slip.date).toBe("25012024");
    }
  });

  it("rejects a tampered CRC", () => {
    const tampered = STANDARD_SLIP.slice(0, -4) + "0000";
    expect(parseSlipPayload(tampered)).toBeNull();
  });

  it("rejects non-slip payloads", () => {
    expect(parseSlipPayload("00020101021229370016A0000006770101110113006681234567853037646304ABCD")).toBeNull();
    expect(parseSlipPayload("")).toBeNull();
    expect(parseSlipPayload("<script>alert(1)</script>")).toBeNull();
  });

  it("validates CRC16-CCITT and TLV structure", () => {
    expect(slipCrcValid(STANDARD_SLIP)).toBe(true);
    expect(parseTlv("0002AB")?.length).toBe(1);
    expect(parseTlv("0005AB")).toBeNull();
    expect(parseTlv("0A02AB")).toBeNull();
  });

  it("does not accept a second root CRC tag", () => {
    const duplicate = `${STANDARD_SLIP.slice(0, -8)}9104${STANDARD_SLIP.slice(-8)}`;
    expect(parseSlipPayload(duplicate)).toBeNull();
  });
});
