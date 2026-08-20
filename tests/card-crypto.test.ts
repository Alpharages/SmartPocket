import { beforeEach, describe, expect, it, vi } from "vitest";
import { bytesToBase64, hexToBytes } from "@shared/base64";
import { testId } from "./helpers/ids";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const USER_ID = testId(1);

/**
 * The card key is per-account now (server/_core/card-key.ts), so it lives on
 * the user row and is read through `dbQuery` like anything else. Just
 * enough of a users table to mint and remember one.
 */
const dbApi = vi.hoisted(() => {
  const store = { cardKey: null as string | null };
  const dbQuery = vi.fn(async (rawSql: string, rawParams?: unknown[]) => {
    const sql = String(rawSql ?? "");
    const params = (rawParams ?? []) as unknown[];
    if (sql.includes("SELECT cardKey")) return [{ cardKey: store.cardKey }];
    if (sql.includes("UPDATE users SET cardKey")) {
      store.cardKey ??= params[0] as string;
      return { affectedRows: 1 };
    }
    return [];
  });
  return { store, dbQuery };
});
vi.mock("@/server/_core/db-query", () => ({ dbQuery: dbApi.dbQuery }));

describe("card crypto", () => {
  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    dbApi.store.cardKey = null;
    vi.resetModules();
  });

  it("round-trips a PAN through encrypt/decrypt", async () => {
    const { decryptCardNumber, encryptCardNumber, isEncryptedCardNumber } =
      await import("@/server/_core/crypto");

    const plain = "4111111111111111";
    const stored = await encryptCardNumber(plain, USER_ID);

    expect(stored).not.toBe(plain);
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(await decryptCardNumber(stored, USER_ID)).toBe(plain);
  });

  it("produces different ciphertext for the same PAN (unique IV)", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const a = await encryptCardNumber("4111111111111111", USER_ID);
    const b = await encryptCardNumber("4111111111111111", USER_ID);
    expect(a).not.toBe(b);
  });

  it("does not double-encrypt an already encrypted value", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const once = await encryptCardNumber("4111111111111111", USER_ID);
    expect(await encryptCardNumber(once, USER_ID)).toBe(once);
  });

  it("passes through legacy plaintext on decrypt", async () => {
    const { decryptCardNumber } = await import("@/server/_core/crypto");
    expect(await decryptCardNumber("4111111111111111", USER_ID)).toBe(
      "4111111111111111",
    );
  });

  it("throws when the ciphertext/auth tag is tampered", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const stored = await encryptCardNumber("4111111111111111", USER_ID);
    // v1:<iv b64>:<ciphertext+tag b64> — the tag is the trailing 16 bytes of
    // the combined blob (@noble/ciphers appends it, unlike Node's crypto,
    // which exposed it separately). Flip one byte anywhere in that blob and
    // GCM must refuse to decrypt.
    const [, iv, combined] = stored.split(":");
    const flipped = combined.startsWith("A")
      ? `B${combined.slice(1)}`
      : `A${combined.slice(1)}`;
    const tampered = `v1:${iv}:${flipped}`;
    await expect(decryptCardNumber(tampered, USER_ID)).rejects.toThrow();
  });

  it("still decrypts the legacy three-segment format (iv:authTag:ciphertext)", async () => {
    // Pre-@noble/ciphers rows were stored with the auth tag as its own
    // segment rather than appended to the ciphertext. Encrypt via the new
    // path, then reassemble into the legacy layout to prove old rows never
    // needed a re-encryption pass.
    const { encryptCardNumber, decryptCardNumber } =
      await import("@/server/_core/crypto");
    const plain = "4111111111111111";
    const stored = await encryptCardNumber(plain, USER_ID);
    const [, ivB64, combinedB64] = stored.split(":");

    const { base64ToBytes } = await import("@shared/base64");
    const combined = base64ToBytes(combinedB64);
    const ciphertext = combined.slice(0, combined.length - 16);
    const tag = combined.slice(combined.length - 16);
    const legacyFormat = `v1:${ivB64}:${bytesToBase64(tag)}:${bytesToBase64(ciphertext)}`;

    expect(await decryptCardNumber(legacyFormat, USER_ID)).toBe(plain);
  });

  // The global CARD_ENCRYPTION_KEY is decrypt-only now: encryption uses the
  // per-account key, so a server with no env key set still works for every
  // account. It used to be the only key, and its absence broke every write.
  it("encrypts without CARD_ENCRYPTION_KEY set at all", async () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptCardNumber, decryptCardNumber } =
      await import("@/server/_core/crypto");

    const stored = await encryptCardNumber("4111111111111111", USER_ID);
    expect(stored).toMatch(/^v1:/);
    expect(await decryptCardNumber(stored, USER_ID)).toBe("4111111111111111");
  });

  // Rows written before drizzle/0015_user_card_key.sql are encrypted under
  // the old global key, and nothing in the ciphertext says so — the account
  // key simply fails to open them, and the env key is tried next.
  it("falls back to the env key for a row written before per-account keys", async () => {
    const { encryptWithKey } = await import("@/server/_core/card-cipher");
    const legacyRow = encryptWithKey(
      "4111111111111111",
      hexToBytes(TEST_KEY_HEX),
    );

    const { decryptCardNumber } = await import("@/server/_core/crypto");
    expect(await decryptCardNumber(legacyRow, USER_ID)).toBe(
      "4111111111111111",
    );
    // ...and the account key really is a different key, so that was a genuine
    // fallback rather than the same value twice.
    expect(dbApi.store.cardKey).not.toBe(
      bytesToBase64(hexToBytes(TEST_KEY_HEX)),
    );
  });

  it("gives two accounts different keys", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    await encryptCardNumber("4111111111111111", USER_ID);
    const first = dbApi.store.cardKey;

    dbApi.store.cardKey = null;
    await encryptCardNumber("4111111111111111", testId(2));

    expect(dbApi.store.cardKey).not.toBe(first);
  });

  it("round-trips min(13) and max(19) length PANs", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const minPan = "4111111111111";
    const maxPan = "4111111111111111111";
    expect(minPan).toHaveLength(13);
    expect(maxPan).toHaveLength(19);
    expect(
      await decryptCardNumber(
        await encryptCardNumber(minPan, USER_ID),
        USER_ID,
      ),
    ).toBe(minPan);
    expect(
      await decryptCardNumber(
        await encryptCardNumber(maxPan, USER_ID),
        USER_ID,
      ),
    ).toBe(maxPan);
  });

  it("round-trips empty and non-numeric input", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    expect(
      await decryptCardNumber(await encryptCardNumber("", USER_ID), USER_ID),
    ).toBe("");
    const nonNumeric = "abcd-efgh-ijkl";
    expect(
      await decryptCardNumber(
        await encryptCardNumber(nonNumeric, USER_ID),
        USER_ID,
      ),
    ).toBe(nonNumeric);
  });

  it("round-trips unicode input", async () => {
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const unicode = "カード番号テスト";
    expect(
      await decryptCardNumber(
        await encryptCardNumber(unicode, USER_ID),
        USER_ID,
      ),
    ).toBe(unicode);
  });

  it("accepts a base64-encoded 32-byte key", async () => {
    process.env.CARD_ENCRYPTION_KEY = bytesToBase64(hexToBytes(TEST_KEY_HEX));
    vi.resetModules();
    const { decryptCardNumber, encryptCardNumber } =
      await import("@/server/_core/crypto");
    const plain = "4111111111111111";
    expect(
      await decryptCardNumber(await encryptCardNumber(plain, USER_ID), USER_ID),
    ).toBe(plain);
  });
});
