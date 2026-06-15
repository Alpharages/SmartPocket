import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

const baseRow = {
  id: 1,
  userId: 1,
  name: "Test",
  cardholderName: "Tester",
  expiryMonth: 12,
  expiryYear: 2028,
  creditLimit: "1000.00",
  currentBalance: "0.00",
  color: "#6366F1",
  cardType: "credit",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("credit card response masking", () => {
  beforeEach(() => {
    process.env.CARD_ENCRYPTION_KEY = TEST_KEY_HEX;
    callDataApi.mockReset();
    vi.resetModules();
  });

  it("masks list responses with cardNumberLast4 and no cardNumber key", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto");
    callDataApi.mockResolvedValue([
      { ...baseRow, cardNumber: encryptCardNumber("4111111111111111") },
    ]);

    const { getUserCreditCards } = await import("@/server/db");
    const cards = await getUserCreditCards(1);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.cardNumberLast4).toBe("1111");
    expect("cardNumber" in (cards[0] ?? {})).toBe(false);
  });

  it("masks getCreditCardById responses", async () => {
    callDataApi.mockResolvedValue([
      { ...baseRow, cardNumber: "5555555555554444" },
    ]);

    const { getCreditCardById } = await import("@/server/db");
    const card = await getCreditCardById(1);

    expect(card?.cardNumberLast4).toBe("4444");
    expect(card && "cardNumber" in card).toBe(false);
  });

  it("returns masked card from createCreditCard", async () => {
    callDataApi
      .mockResolvedValueOnce({ insertId: 42 })
      .mockResolvedValueOnce([{ ...baseRow, id: 42, cardNumber: "4111111111111111" }]);

    const { createCreditCard } = await import("@/server/db");
    const created = await createCreditCard({
      userId: 1,
      name: "Test",
      cardNumber: "4111111111111111",
      cardholderName: "Tester",
      expiryMonth: 12,
      expiryYear: 2028,
      creditLimit: "1000.00",
      color: "#6366F1",
      cardType: "credit",
    });

    expect(created?.cardNumberLast4).toBe("1111");
    expect(created && "cardNumber" in created).toBe(false);
  });

  it("returns masked card from updateCreditCard", async () => {
    callDataApi
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        { ...baseRow, name: "Renamed", cardNumber: "378282246310005" },
      ]);

    const { updateCreditCard } = await import("@/server/db");
    const updated = await updateCreditCard(1, { name: "Renamed" });

    expect(updated?.cardNumberLast4).toBe("0005");
    expect(updated && "cardNumber" in updated).toBe(false);
  });
});
