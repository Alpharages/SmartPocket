import { beforeEach, describe, expect, it, vi } from "vitest";
import { bytesToBase64, hexToBytes } from "@shared/base64";

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
    const stored = await encryptCardNumber(plain);

    expect(stored).not.toBe(plain);
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(await decryptCardNumber(stored)).toBe(plain);
  });

  it("produces different ciphertext for the same PAN (unique IV)", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const a = await encryptCardNumber("4111111111111111");
    const b = await encryptCardNumber("4111111111111111");
    expect(a).not.toBe(b);
  });

  it("does not double-encrypt an already encrypted value", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const once = await encryptCardNumber("4111111111111111");
    expect(await encryptCardNumber(once)).toBe(once);
  });

  it("passes through legacy plaintext on decrypt", async () => {
    const { decryptCardNumber } = await import("@/server/_core/crypto");
    expect(await decryptCardNumber("4111111111111111")).toBe(
      "4111111111111111",
    );
  });

  it("throws when the ciphertext/auth tag is tampered", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const stored = await encryptCardNumber("4111111111111111");
    // v1:<iv b64>:<ciphertext+tag b64> — the tag is the trailing 16 bytes of
    // the combined blob (@noble/ciphers appends it, unlike Node's crypto,
    // which exposed it separately). Flip one byte anywhere in that blob and
    // GCM must refuse to decrypt.
    const [, iv, combined] = stored.split(":");
    const flipped = combined.startsWith("A")
      ? `B${combined.slice(1)}`
      : `A${combined.slice(1)}`;
    const tampered = `v1:${iv}:${flipped}`;
    await expect(decryptCardNumber(tampered)).rejects.toThrow();
  });

  it("still decrypts the legacy three-segment format (iv:authTag:ciphertext)", async () => {
    // Pre-@noble/ciphers rows were stored with the auth tag as its own
    // segment rather than appended to the ciphertext. Encrypt via the new
    // path, then reassemble into the legacy layout to prove old rows never
    // needed a re-encryption pass.
    const { encryptCardNumber, decryptCardNumber } =
      await import("@/server/_core/crypto");
    const plain = "4111111111111111";
    const stored = await encryptCardNumber(plain);
    const [, ivB64, combinedB64] = stored.split(":");

    const { base64ToBytes } = await import("@shared/base64");
    const combined = base64ToBytes(combinedB64);
    const ciphertext = combined.slice(0, combined.length - 16);
    const tag = combined.slice(combined.length - 16);
    const legacyFormat = `v1:${ivB64}:${bytesToBase64(tag)}:${bytesToBase64(ciphertext)}`;

    expect(await decryptCardNumber(legacyFormat)).toBe(plain);
  });

  it("throws when CARD_ENCRYPTION_KEY is missing", async () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    await expect(encryptCardNumber("4111111111111111")).rejects.toThrow(
      /CARD_ENCRYPTION_KEY/,
    );
  });

  it("throws when CARD_ENCRYPTION_KEY is wrong length", async () => {
    process.env.CARD_ENCRYPTION_KEY = "tooshort";
    vi.resetModules();
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    await expect(encryptCardNumber("4111111111111111")).rejects.toThrow(
      /32 bytes/,
    );
  });

  it("round-trips min(13) and max(19) length PANs", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const minPan = "4111111111111";
    const maxPan = "4111111111111111111";
    expect(minPan).toHaveLength(13);
    expect(maxPan).toHaveLength(19);
    expect(await decryptCardNumber(await encryptCardNumber(minPan))).toBe(
      minPan,
    );
    expect(await decryptCardNumber(await encryptCardNumber(maxPan))).toBe(
      maxPan,
    );
  });

  it("round-trips empty and non-numeric input", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    expect(await decryptCardNumber(await encryptCardNumber(""))).toBe("");
    const nonNumeric = "abcd-efgh-ijkl";
    expect(
      await decryptCardNumber(await encryptCardNumber(nonNumeric)),
    ).toBe(nonNumeric);
  });

  it("round-trips unicode input", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const unicode = "カード番号テスト";
    expect(await decryptCardNumber(await encryptCardNumber(unicode))).toBe(
      unicode,
    );
  });

  it("accepts a base64-encoded 32-byte key", async () => {
    process.env.CARD_ENCRYPTION_KEY = bytesToBase64(hexToBytes(TEST_KEY_HEX));
    vi.resetModules();
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const plain = "4111111111111111";
    expect(await decryptCardNumber(await encryptCardNumber(plain))).toBe(
      plain,
    );
  });
});
