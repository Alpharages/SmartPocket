import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testId, syncColumns } from "./helpers/ids";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

describe("migrateEncryptCardNumbers", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    callDataApi.mockReset();
    consoleErrorSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("encrypts plaintext rows and updates the database", async () => {
    callDataApi
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

    const updateCall = callDataApi.mock.calls[1][1] as {
      body: { query: string; params: unknown[] };
    };
    expect(updateCall.body.query).toContain("UPDATE creditCards");
    const stored = updateCall.body.params[0] as string;
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(decryptCardNumber(stored)).toBe("4111111111111111");
  });

  it("skips already-encrypted rows (idempotent re-run)", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const encrypted = encryptCardNumber("4111111111111111");

    callDataApi.mockResolvedValueOnce([
      { id: testId(2), cardNumber: encrypted },
    ]);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 1,
      encrypted: 0,
      skipped: 1,
      failed: 0,
    });
    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("handles a mixed table of plaintext and encrypted rows", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const encrypted = encryptCardNumber("5555555555554444");

    callDataApi
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
    expect(callDataApi).toHaveBeenCalledTimes(3);
  });

  it("returns a clean summary on an empty table", async () => {
    callDataApi.mockResolvedValueOnce([]);

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
    callDataApi.mockResolvedValueOnce(null);

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");
    const summary = await migrateEncryptCardNumbers();

    expect(summary).toEqual({
      total: 0,
      encrypted: 0,
      skipped: 0,
      failed: 0,
    });
    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("logs counts only — never card numbers in output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    callDataApi
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
    callDataApi
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

  it("aborts before mutating rows when CARD_ENCRYPTION_KEY is missing", async () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    vi.resetModules();

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");

    await expect(migrateEncryptCardNumbers()).rejects.toThrow(
      /CARD_ENCRYPTION_KEY/,
    );
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("aborts before mutating rows when CARD_ENCRYPTION_KEY is wrong length", async () => {
    process.env.CARD_ENCRYPTION_KEY = "tooshort";
    vi.resetModules();

    const { migrateEncryptCardNumbers } =
      await import("@/server/migrate-encrypt-card-numbers");

    await expect(migrateEncryptCardNumbers()).rejects.toThrow(/32 bytes/);
    expect(callDataApi).not.toHaveBeenCalled();
  });
});
