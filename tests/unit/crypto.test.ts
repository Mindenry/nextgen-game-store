import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, hmacSha256, safeEqualHex, verifyPassword } from "@/lib/crypto";

describe("encryption and password hashing", () => {
  it("encrypts and decrypts sensitive payloads with AES-256-GCM", () => {
    const secret = JSON.stringify({ username: "player", password: "s3cret", recovery: "code" });
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain("s3cret");
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("detects tampering via the auth tag", () => {
    const encrypted = encryptSecret("hello");
    const parts = encrypted.split(".");
    const tampered = [...parts.slice(0, 3), parts[3].slice(0, -2) + "AA"].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("hashes passwords with scrypt and verifies them", async () => {
    const hash = await hashPassword("SuperSecret123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("SuperSecret123");
    expect(await verifyPassword("SuperSecret123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("SuperSecret123", null)).toBe(false);
  });

  it("compares HMAC signatures in constant time", () => {
    const a = hmacSha256("payload", "secret");
    const b = hmacSha256("payload", "secret");
    expect(safeEqualHex(a, b)).toBe(true);
    expect(safeEqualHex(a, hmacSha256("payload2", "secret"))).toBe(false);
  });
});
