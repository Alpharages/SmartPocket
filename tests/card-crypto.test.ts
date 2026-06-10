import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("card crypto", () => {
  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    vi.resetModules();
  });

  it("round-trips a PAN through encrypt/decrypt", async () => {
    const { decryptCardNumber, encryptCardNumber, isEncryptedCardNumber } =
      await import("@/server/_core/crypto");

    const plain = "4111111111111111";
    const stored = encryptCardNumber(plain);

    expect(stored).not.toBe(plain);
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(decryptCardNumber(stored)).toBe(plain);
  });

  it("produces different ciphertext for the same PAN (unique IV)", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const a = encryptCardNumber("4111111111111111");
    const b = encryptCardNumber("4111111111111111");
    expect(a).not.toBe(b);
  });

  it("does not double-encrypt an already encrypted value", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const once = encryptCardNumber("4111111111111111");
    expect(encryptCardNumber(once)).toBe(once);
  });

  it("passes through legacy plaintext on decrypt", async () => {
    const { decryptCardNumber } = await import("@/server/_core/crypto");
    expect(decryptCardNumber("4111111111111111")).toBe("4111111111111111");
  });

  it("throws when auth tag is tampered", async () => {
    const { decryptCardNumber, encryptCardNumber } = await import(
      "@/server/_core/crypto"
    );
    const stored = encryptCardNumber("4111111111111111");
    const [, iv, tag, cipher] = stored.split(":");
    const flippedTag = tag.startsWith("A") ? `B${tag.slice(1)}` : `A${tag.slice(1)}`;
    const tampered = `v1:${iv}:${flippedTag}:${cipher}`;
    expect(() => decryptCardNumber(tampered)).toThrow();
  });

  it("throws when CARD_ENCRYPTION_KEY is missing", async () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    expect(() => encryptCardNumber("4111111111111111")).toThrow(
      /CARD_ENCRYPTION_KEY/,
    );
  });

  it("throws when CARD_ENCRYPTION_KEY is wrong length", async () => {
    process.env.CARD_ENCRYPTION_KEY = "tooshort";
    vi.resetModules();
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    expect(() => encryptCardNumber("4111111111111111")).toThrow(
      /32 bytes/,
    );
  });

  it("round-trips min(13) and max(19) length PANs", async () => {
    const { decryptCardNumber, encryptCardNumber } = await import(
      "@/server/_core/crypto"
    );
    const minPan = "4111111111111";
    const maxPan = "4111111111111111111";
    expect(minPan).toHaveLength(13);
    expect(maxPan).toHaveLength(19);
    expect(decryptCardNumber(encryptCardNumber(minPan))).toBe(minPan);
    expect(decryptCardNumber(encryptCardNumber(maxPan))).toBe(maxPan);
  });

  it("round-trips empty and non-numeric input", async () => {
    const { decryptCardNumber, encryptCardNumber } = await import(
      "@/server/_core/crypto"
    );
    expect(decryptCardNumber(encryptCardNumber(""))).toBe("");
    const nonNumeric = "abcd-efgh-ijkl";
    expect(decryptCardNumber(encryptCardNumber(nonNumeric))).toBe(nonNumeric);
  });

  it("round-trips unicode input", async () => {
    const { decryptCardNumber, encryptCardNumber } = await import(
      "@/server/_core/crypto"
    );
    const unicode = "カード番号テスト";
    expect(decryptCardNumber(encryptCardNumber(unicode))).toBe(unicode);
  });

  it("accepts a base64-encoded 32-byte key", async () => {
    process.env.CARD_ENCRYPTION_KEY = Buffer.from(TEST_KEY_HEX, "hex").toString(
      "base64",
    );
    vi.resetModules();
    const { decryptCardNumber, encryptCardNumber } = await import(
      "@/server/_core/crypto"
    );
    const plain = "4111111111111111";
    expect(decryptCardNumber(encryptCardNumber(plain))).toBe(plain);
  });
});
