import { describe, expect, it } from "vitest";
import { toTransactionCsv, transactionToExportRow } from "@/lib/csv-export";
import {
  toTransactionJson,
  transactionToJsonExportRow,
} from "@/lib/json-export";
import type { Category, CreditCard, Transaction } from "@/lib/expense-context";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    userId: 1,
    categoryId: 10,
    creditCardId: 20,
    type: "expense",
    amount: "1234.5",
    description: 'Coffee, "large"\n☕',
    date: new Date(2026, 5, 16, 10, 0, 0),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 10,
    userId: 1,
    name: "Food",
    type: "expense",
    color: "#ff0000",
    icon: "food",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 20,
    userId: 1,
    name: "Visa Gold",
    cardNumberLast4: "1234",
    cardholderName: "Test User",
    expiryMonth: 12,
    expiryYear: 2028,
    creditLimit: "5000.00",
    currentBalance: "0.00",
    color: "#0000ff",
    cardType: "visa",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("toTransactionJson", () => {
  it("produces the export envelope with embedded category and card refs", () => {
    const rows = [
      transactionToJsonExportRow(
        makeTransaction(),
        [makeCategory()],
        [makeCard()],
      ),
      transactionToJsonExportRow(
        makeTransaction({ id: 2, creditCardId: undefined }),
        [makeCategory()],
        [makeCard()],
      ),
    ];

    const parsed = JSON.parse(toTransactionJson(rows, { currency: "USD" }));

    expect(parsed).toMatchObject({
      version: 1,
      app: "SmartPocket",
      currency: "USD",
      count: 2,
    });
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
    expect(parsed.transactions[0]).toMatchObject({
      id: 1,
      type: "expense",
      amount: "1234.50",
      date: "2026-06-16",
      description: 'Coffee, "large"\n☕',
      category: {
        id: 10,
        name: "Food",
        type: "expense",
        color: "#ff0000",
        icon: "food",
      },
      card: { id: 20, name: "Visa Gold" },
    });
    expect(parsed.transactions[1].card).toBeNull();
  });

  it("pretty-prints with two-space indentation", () => {
    const out = toTransactionJson([], { currency: "USD" });
    expect(out).toContain('\n  "version": 1,');
    expect(JSON.parse(out).count).toBe(0);
  });

  it("keeps JSON fields string-for-string compatible with CSV columns", () => {
    const tx = makeTransaction();
    const categories = [makeCategory()];
    const cards = [makeCard()];

    const csvRow = transactionToExportRow(tx, categories, cards);
    const jsonRow = transactionToJsonExportRow(tx, categories, cards);

    expect(jsonRow.date).toBe(csvRow.date);
    expect(jsonRow.type).toBe(csvRow.type);
    expect(jsonRow.amount).toBe(csvRow.amount);
    expect(jsonRow.category.name).toBe(csvRow.category);
    expect(jsonRow.card?.name).toBe(csvRow.card);
    expect(jsonRow.description).toBe(csvRow.description);
    expect(toTransactionCsv([csvRow])).toContain(csvRow.amount);
  });

  it("serializes unresolved cards as null", () => {
    const row = transactionToJsonExportRow(
      makeTransaction({ creditCardId: 999 }),
      [makeCategory()],
      [makeCard()],
    );
    expect(row.card).toBeNull();
  });
});
