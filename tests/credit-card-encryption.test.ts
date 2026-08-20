import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("credit card db encryption", () => {
  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    dbQuery.mockReset();
    vi.resetModules();
  });

  it("encrypts cardNumber on createCreditCard", async () => {
    dbQuery.mockResolvedValue({ insertId: 42 });
    const { createCreditCard } = await import("@/server/db");
    const { isEncryptedCardNumber } = await import("@/server/_core/crypto");

    await createCreditCard({
      userId: testId(1),
      name: "Test",
      cardNumber: "4111111111111111",
      cardholderName: "Tester",
      expiryMonth: 12,
      expiryYear: 2028,
      creditLimit: "1000.00",
      color: "#6366F1",
      cardType: "credit",
    });

    const body = bodyOf(dbQuery.mock.calls[0]) as {
      params: unknown[];
    };
    const stored = body.params[3] as string;
    expect(stored).not.toBe("4111111111111111");
    expect(isEncryptedCardNumber(stored)).toBe(true);
  });

  it("encrypts cardNumber on updateCreditCard when present", async () => {
    dbQuery.mockResolvedValue(undefined);
    const { updateCreditCard } = await import("@/server/db");
    const { isEncryptedCardNumber } = await import("@/server/_core/crypto");

    await updateCreditCard(testId(1), testId(1), {
      cardNumber: "5555555555554444",
    });

    const body = bodyOf(dbQuery.mock.calls[0]) as {
      params: unknown[];
    };
    const stored = body.params[0] as string;
    expect(isEncryptedCardNumber(stored)).toBe(true);
  });

  it("does not encrypt on update when cardNumber is omitted", async () => {
    dbQuery.mockResolvedValue(undefined);
    const { updateCreditCard } = await import("@/server/db");

    await updateCreditCard(testId(1), testId(1), { name: "Renamed" });

    const body = bodyOf(dbQuery.mock.calls[0]) as {
      query: string;
      params: unknown[];
    };
    expect(body.query).not.toContain("cardNumber");
    expect(body.params).toEqual([
      "Renamed",
      expect.any(Date),
      testId(1),
      testId(1),
    ]);
  });

  it("decrypts cardNumber on getCreditCardById then masks the response", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const ciphertext = await encryptCardNumber(
      "4111111111111111",
      TEST_USER_ID,
    );

    dbQuery.mockResolvedValue([
      {
        id: testId(1),
        userId: testId(1),
        name: "Test",
        cardNumber: ciphertext,
        cardholderName: "Tester",
        expiryMonth: 12,
        expiryYear: 2028,
        creditLimit: "1000.00",
        color: "#6366F1",
        cardType: "credit",
      },
    ]);

    const { getCreditCardById } = await import("@/server/db");
    const card = await getCreditCardById(testId(1), testId(1));
    expect(card?.cardNumberLast4).toBe("1111");
    expect(card && "cardNumber" in card).toBe(false);
  });

  it("decrypts cardNumber on getUserCreditCards then masks each row", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    const ciphertext = await encryptCardNumber(
      "4111111111111111",
      TEST_USER_ID,
    );

    dbQuery.mockResolvedValue([
      {
        id: testId(1),
        userId: testId(1),
        name: "Test",
        cardNumber: ciphertext,
      },
    ]);

    const { getUserCreditCards } = await import("@/server/db");
    const cards = await getUserCreditCards(testId(1));
    expect(cards[0]?.cardNumberLast4).toBe("1111");
    expect(cards[0] && "cardNumber" in cards[0]).toBe(false);
  });

  it("returns legacy plaintext rows masked on read", async () => {
    dbQuery.mockResolvedValue([
      {
        id: testId(1),
        userId: testId(1),
        name: "Legacy",
        cardNumber: "4111111111111111",
      },
    ]);

    const { getUserCreditCards } = await import("@/server/db");
    const cards = await getUserCreditCards(testId(1));
    expect(cards[0]?.cardNumberLast4).toBe("1111");
    expect(cards[0] && "cardNumber" in cards[0]).toBe(false);
  });
});
