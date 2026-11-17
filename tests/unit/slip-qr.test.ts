import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { decodeSlipQr } from "@/lib/slip-qr";

const STANDARD_SLIP = "004000060000010103002021900021231231212000115102TH91049C30";
const TRUEMONEY_SLIP = "00480002010102010203P2P0313TXN00012345670408250120249104b425";

async function qrPng(text: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(text, { margin: 2, width: 320 });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

describe("self-hosted slip QR decoder", () => {
  it("decodes a standard slip Mini QR from a PNG image", async () => {
    const text = await decodeSlipQr(await qrPng(STANDARD_SLIP));
    expect(text).toBe(STANDARD_SLIP);
  });

  it("decodes a TrueMoney slip Mini QR from a PNG image", async () => {
    const text = await decodeSlipQr(await qrPng(TRUEMONEY_SLIP));
    expect(text).toBe(TRUEMONEY_SLIP);
  });

  it("returns null for a valid image without a QR", async () => {
    const png = readFileSync(resolve("tests/e2e/fixtures/slip.png"));
    const result = await decodeSlipQr(png);
    expect(result).toBeNull();
  });
});
