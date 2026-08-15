import { describe, expect, it } from "vitest";
import {
  autoMapColumns,
  duplicateKey,
  findDuplicate,
  parseCsv,
  validateRow,
} from "@/lib/csv-import";
import { toTransactionCsv, transactionToExportRow } from "@/lib/csv-export";
import type { Category, CreditCard, Transaction } from "@/lib/expense-context";
import { testId, syncColumns } from "../helpers/ids";

const food: Category = {
  id: testId(10),
  userId: testId(1),
  name: "Food",
  type: "expense",
  color: "#f00",
  icon: "food",
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const salary: Category = {
  ...food,
  id: testId(11),
  name: "Salary",
  type: "income",
};

const card: CreditCard = {
  id: testId(20),
  userId: testId(1),
  name: "Visa Gold",
  cardNumberLast4: "1234",
  cardholderName: "Test User",
  expiryMonth: 12,
  expiryYear: 2028,
  creditLimit: "5000.00",
  currentBalance: "0.00",
  color: "#00f",
  cardType: "visa",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: testId(1),
    userId: testId(1),
    categoryId: food.id,
    type: "expense",
    amount: "50.00",
    description: "Coffee",
    date: new Date(2026, 5, 16),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("parseCsv", () => {
  it("parses quoted commas, doubled quotes, and embedded newlines", () => {
    const parsed = parseCsv(
      'Date,Type,Amount,Category,Card,Description\r\n2026-06-16,expense,12.30,Food,,"He said ""hi"", then left\nnext"',
    );

    expect(parsed.headers).toEqual([
      "Date",
      "Type",
      "Amount",
      "Category",
      "Card",
      "Description",
    ]);
    expect(parsed.rows[0][5]).toBe('He said "hi", then left\nnext');
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsv('Date\n"2026-06-16')).toThrow(/unclosed/i);
  });
});

describe("autoMapColumns", () => {
  it("maps canonical columns case-insensitively", () => {
    expect(
      autoMapColumns([
        "amount",
        "CATEGORY",
        "Date",
        "Description",
        "Card",
        "Type",
      ]),
    ).toEqual({
      amount: 0,
      category: 1,
      date: 2,
      description: 3,
      card: 4,
      type: 5,
    });
  });
});

describe("validateRow", () => {
  const map = autoMapColumns([
    "Date",
    "Type",
    "Amount",
    "Category",
    "Card",
    "Description",
  ]);

  it("normalizes valid rows", () => {
    const result = validateRow(
      ["2026-06-16", "EXPENSE", "12.3", "food", "visa gold", "Lunch"],
      map,
      { categories: [food, salary], creditCards: [card], rowIndex: 2 },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        type: "expense",
        amount: "12.30",
        categoryId: food.id,
        creditCardId: card.id,
        description: "Lunch",
      },
    });
  });

  it("reports distinct invalid row reasons", () => {
    expect(
      validateRow(["bad", "expense", "1", "Food", "", ""], map, {
        categories: [food],
        creditCards: [],
        rowIndex: 2,
      }),
    ).toMatchObject({ ok: false, reason: "Invalid date" });
    expect(
      validateRow(["2026-06-16", "transfer", "1", "Food", "", ""], map, {
        categories: [food],
        creditCards: [],
        rowIndex: 3,
      }),
    ).toMatchObject({ ok: false, reason: "Invalid type" });
    expect(
      validateRow(["2026-06-16", "expense", "0", "Food", "", ""], map, {
        categories: [food],
        creditCards: [],
        rowIndex: 4,
      }),
    ).toMatchObject({ ok: false, reason: "Invalid amount" });
    expect(
      validateRow(["2026-06-16", "expense", "1", "Other", "", ""], map, {
        categories: [food],
        creditCards: [],
        rowIndex: 5,
      }),
    ).toMatchObject({ ok: false, reason: "Unknown category" });
  });

  it("resolves the correctly-typed category when a same-named category exists for the other type", () => {
    const otherExpense = { ...food, id: testId(30), name: "Other" };
    const otherIncome = { ...salary, id: testId(31), name: "Other" };

    const result = validateRow(
      ["2026-06-16", "income", "100", "Other", "", ""],
      map,
      {
        categories: [otherExpense, otherIncome],
        creditCards: [],
        rowIndex: 2,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { categoryId: testId(31) },
    });
  });

  it("reports a type-mismatch reason when only the wrong-typed category shares the name", () => {
    const otherExpense = { ...food, id: testId(30), name: "Other" };

    expect(
      validateRow(["2026-06-16", "income", "100", "Other", "", ""], map, {
        categories: [otherExpense],
        creditCards: [],
        rowIndex: 2,
      }),
    ).toMatchObject({
      ok: false,
      reason: "Category type does not match row type",
    });
  });
});

describe("duplicateKey", () => {
  it("produces the same key for equivalent transactions and a different key otherwise", () => {
    const a = tx();
    const b = tx();
    const differentDescription = tx({ description: "Tea" });

    expect(duplicateKey(a)).toBe(duplicateKey(b));
    expect(duplicateKey(a)).not.toBe(duplicateKey(differentDescription));
  });
});

describe("findDuplicate", () => {
  it("matches date/type/amount/category/description", () => {
    expect(
      findDuplicate(
        {
          categoryId: food.id,
          type: "expense",
          amount: "50.00",
          description: "Coffee",
          date: new Date(2026, 5, 16),
        },
        [tx()],
      ),
    ).toBe(true);
    expect(
      findDuplicate(
        {
          categoryId: food.id,
          type: "expense",
          amount: "50.00",
          description: "Tea",
          date: new Date(2026, 5, 16),
        },
        [tx()],
      ),
    ).toBe(false);
  });
});

describe("CSV export round-trip", () => {
  it("imports a row exported by Story 10.1", () => {
    const csv = toTransactionCsv([
      transactionToExportRow(tx({ creditCardId: card.id }), [food], [card]),
    ]);
    const parsed = parseCsv(csv);
    const result = validateRow(parsed.rows[0], autoMapColumns(parsed.headers), {
      categories: [food],
      creditCards: [card],
      rowIndex: 2,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        amount: "50.00",
        categoryId: food.id,
        creditCardId: card.id,
      },
    });
  });
});
