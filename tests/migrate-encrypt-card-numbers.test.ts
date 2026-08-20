import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testId, syncColumns } from "./helpers/ids";

/**
 * The old envelope shape, rebuilt from the (sql, params) argument pair so these
 * assertions keep reading as "what statement, with what values".
 */
function bodyOf(call: unknown[]) {
  return { query: String(call[0]), params: (call[1] ?? []) as unknown[] };
}

// The card key is per-account now and read off the user row. These tests
// mock `dbQuery` wholesale for their own purposes, so the key lookup is
// stubbed rather than fed through that mock — key provisioning has its own
// coverage in tests/card-crypto.test.ts.
const TEST_USER_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEST_CARD_KEY = new Uint8Array(32).fill(7);
vi.mock("@/server/_core/card-key", () => ({
  getOrCreateAccountCardKey: vi.fn(async () => TEST_CARD_KEY),
  getAccountCardKeyBase64: vi.fn(async () => "unused"),
}));

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

describe("migrateEncryptCardNumbers", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    dbQuery.mockReset();
    consoleErrorSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("encrypts plaintext rows and updates the database", async () => {
    dbQuery
      .mockResolvedValueOnce([
        { id: testId(1), cardNumber: "4111111111111111" },
      ])
      .mockResolvedValueOnce(undefined);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const { decryptCardNumber, isEncryptedCardNumber } =
      await import("@/server/_core/crypto");

    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 1,
      encrypted: 1,
      skipped: 0,
      failed: 0,
    });

    const updateCall = bodyOf(dbQuery.mock.calls[1]);
    expect(updateCall.query).toContain("UPDATE creditCards");
    const stored = updateCall.params[0] as string;
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(await decryptCardNumber(stored, TEST_USER_ID)).toBe(
      "4111111111111111",
    );
  });

  it("skips already-encrypted rows (idempotent re-run)", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const encrypted = await encryptCardNumber("4111111111111111", TEST_USER_ID);

    dbQuery.mockResolvedValueOnce([{ id: testId(2), cardNumber: encrypted }]);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 1,
      encrypted: 0,
      skipped: 1,
      failed: 0,
    });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it("handles a mixed table of plaintext and encrypted rows", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const encrypted = await encryptCardNumber("5555555555554444", TEST_USER_ID);

    dbQuery
      .mockResolvedValueOnce([
        { id: testId(1), cardNumber: "4111111111111111" },
        { id: testId(2), cardNumber: encrypted },
        { id: testId(3), cardNumber: "378282246310005" },
      ])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 3,
      encrypted: 2,
      skipped: 1,
      failed: 0,
    });
    expect(dbQuery).toHaveBeenCalledTimes(3);
  });

  it("returns a clean summary on an empty table", async () => {
    dbQuery.mockResolvedValueOnce([]);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 0,
      encrypted: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("treats a non-array SELECT response as an empty table", async () => {
    dbQuery.mockResolvedValueOnce(null);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 0,
      encrypted: 0,
      skipped: 0,
      failed: 0,
    });
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it("logs counts only — never card numbers in output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    dbQuery
      .mockResolvedValueOnce([
        { id: testId(7), cardNumber: "4111111111111111" },
      ])
      .mockResolvedValueOnce(undefined);

    const { migrateEncryptCardNumbers, formatMigrationSummary } =
      await import("@/server/migrate-encrypt-card-numbers");

    const summary = await migrateEncryptCardNumbers();
    const line = formatMigrationSummary(summary);
    console.log(line);

    const allOutput = [
      line,
      ...consoleErrorSpy.mock.calls.flat().map(String),
      ...consoleLogSpy.mock.calls.flat().map(String),
    ].join("\n");

    expect(allOutput).not.toMatch(/4111111111111111/);
    expect(allOutput).not.toMatch(/^v1:/m);
    expect(line).toMatch(/total=1/);
    expect(line).toMatch(/encrypted=1/);

    consoleLogSpy.mockRestore();
  });

  it("isolates per-row failures and continues processing", async () => {
    dbQuery
      .mockResolvedValueOnce([
        { id: testId(10), cardNumber: "4111111111111111" },
        { id: testId(11), cardNumber: "5555555555554444" },
      ])
      .mockRejectedValueOnce(new Error("update failed"))
      .mockResolvedValueOnce(undefined);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 2,
      encrypted: 1,
      skipped: 0,
      failed: 1,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Card encryption migration failed for row id=${testId(10)}`,
    );
    const logged = consoleErrorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toMatch(/4111111111111111/);
    expect(logged).not.toMatch(/5555555555554444/);
  });

  // This used to abort up front when the global CARD_ENCRYPTION_KEY was
  // missing or malformed, because that key was the only one there was. Keys
  // are per-account now (server/_core/card-key.ts) and minted on demand, so
  // there is no global precondition left to check — the migration encrypts
  // each row under its own owner's key, and a row that genuinely fails is
  // counted rather than aborting the run.
  it("runs without a global CARD_ENCRYPTION_KEY, encrypting each row under its owner's key", async () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    vi.resetModules();

    dbQuery.mockImplementation(async (rawSql) => {
      const sql = String(rawSql ?? "");
      if (sql.startsWith("SELECT")) {
        return [
          { id: testId(1), userId: testId(9), cardNumber: "4111111111111111" },
        ];
      }
      return { affectedRows: 1 };
    });

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toMatchObject({ total: 1, encrypted: 1, failed: 0 });

    const update = dbQuery.mock.calls.find(([sql]) =>
      String(sql ?? "").startsWith("UPDATE"),
    );
    expect(String(update?.[1]?.[0])).toMatch(/^v1:/);
  });
});
