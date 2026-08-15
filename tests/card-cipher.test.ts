import { describe, expect, it } from "vitest";
import { randomBytes } from "@noble/ciphers/utils.js";
import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedCardNumber,
  maskCardNumber,
} from "@/server/_core/card-cipher";
import { bytesToBase64, base64ToBytes } from "@shared/base64";

const KEY = randomBytes(32);

describe("card-cipher", () => {
  it("round-trips plaintext through encryptWithKey/decryptWithKey", () => {
    const stored = encryptWithKey("4111111111111111", KEY);
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(decryptWithKey(stored, KEY)).toBe("4111111111111111");
  });

  it("produces a two-segment v1:iv:ciphertext+tag format", () => {
    const stored = encryptWithKey("4111111111111111", KEY);
    const parts = stored.slice("v1:".length).split(":");
    expect(parts).toHaveLength(2);
  });

  it("is idempotent — encrypting an already-encrypted value is a no-op", () => {
    const once = encryptWithKey("4111111111111111", KEY);
    expect(encryptWithKey(once, KEY)).toBe(once);
  });

  it("passes plaintext through decryptWithKey unchanged (legacy pre-migration rows)", () => {
    expect(decryptWithKey("4111111111111111", KEY)).toBe("4111111111111111");
  });

  it("fails to decrypt under the wrong key", () => {
    const stored = encryptWithKey("4111111111111111", KEY);
    const wrongKey = randomBytes(32);
    expect(() => decryptWithKey(stored, wrongKey)).toThrow();
  });

  it("decrypts the legacy three-segment format (iv:authTag:ciphertext)", () => {
    const stored = encryptWithKey("4111111111111111", KEY);
    const [, ivB64, combinedB64] = stored.split(":");
    const combined = base64ToBytes(combinedB64);
    const ciphertext = combined.slice(0, combined.length - 16);
    const tag = combined.slice(combined.length - 16);
    const legacy = `v1:${ivB64}:${bytesToBase64(tag)}:${bytesToBase64(ciphertext)}`;

    expect(decryptWithKey(legacy, KEY)).toBe("4111111111111111");
  });

  it("rejects a legacy-shaped payload with a malformed auth tag length", () => {
    const stored = encryptWithKey("4111111111111111", KEY);
    const [, ivB64, combinedB64] = stored.split(":");
    const badLegacy = `v1:${ivB64}:${"AA"}:${combinedB64}`;
    expect(() => decryptWithKey(badLegacy, KEY)).toThrow(
      /Invalid encrypted card number format/,
    );
  });

  it("rejects a payload with the wrong number of segments", () => {
    expect(() => decryptWithKey("v1:onlyonesegment", KEY)).toThrow(
      /Invalid encrypted card number format/,
    );
  });

  it("produces distinct ciphertext for the same plaintext (random IV)", () => {
    const a = encryptWithKey("4111111111111111", KEY);
    const b = encryptWithKey("4111111111111111", KEY);
    expect(a).not.toBe(b);
  });
});

describe("maskCardNumber", () => {
  it("returns the last four digits", () => {
    expect(maskCardNumber("4111111111111111")).toBe("1111");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskCardNumber("  4111111111111111  ")).toBe("1111");
  });

  it("returns an empty string for empty input", () => {
    expect(maskCardNumber("")).toBe("");
    expect(maskCardNumber("   ")).toBe("");
  });
});
