import "server-only";
import sharp from "sharp";
import jsQR from "jsqr";

/**
 * Decode the QR printed on a slip image entirely on our own server.
 * No paid service is involved; the extracted payload is then validated by
 * lib/slip-payload.ts and can be used to pre-check the transfer reference.
 */
export async function decodeSlipQr(bytes: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const result = jsQR(pixels, info.width, info.height, { inversionAttempts: "attemptBoth" });
    return result?.data ?? null;
  } catch (error) {
    console.error("[slip-qr] failed to decode image", error);
    return null;
  }
}
