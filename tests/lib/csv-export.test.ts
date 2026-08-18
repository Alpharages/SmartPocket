import { describe, expect, it } from "vitest";
import {
  escapeCsvField,
  toTransactionCsv,
  transactionToExportRow,
  type ExportRow,
} from "@/lib/csv-export";
import type { Transaction, Category, CreditCard } from "@/lib/expense-context";
import { testId, syncColumns } from "../helpers/ids";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: testId(1),
    userId: testId(1),
    categoryId: testId(10),
    type: "expense",
    amount: "50.00",
    description: "Coffee",
    date: new Date(2026, 5, 16, 10, 0, 0), // 2026-06-16
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: testId(10),
    userId: testId(1),
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
    id: testId(20),
    userId: testId(1),
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

describe("escapeCsvField", () => {
  it("returns plain string unchanged when no special chars", () => {
    expect(escapeCsvField("Hello World")).toBe("Hello World");
  });

  it("wraps field in quotes when it contains a comma", () => {
    expect(escapeCsvField("one,two")).toBe('"one,two"');
  });

  it("wraps field in quotes when it contains a double-quote and doubles the quote", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps field in quotes when it contains a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles description with comma and embedded quote (AC3 spec example)", () => {
    const input = 'He said "hi", then left\n';
    const result = escapeCsvField(input);
    expect(result).toBe('"He said ""hi"", then left\n"');
  });

  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("handles field with only a double-quote", () => {
    expect(escapeCsvField('"')).toBe('""""');
  });
});

describe("transactionToExportRow", () => {
  const categories = [makeCategory()];
  const cards = [makeCard()];

  it("maps all fields correctly for an expense with card", () => {
    const tx = makeTransaction({ creditCardId: testId(20) });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.date).toBe("2026-06-16");
    expect(row.type).toBe("expense");
    expect(row.amount).toBe("50.00");
    expect(row.category).toBe("Food");
    expect(row.card).toBe("Visa Gold");
    expect(row.description).toBe("Coffee");
  });

  it("leaves card blank when transaction has no creditCardId", () => {
    const tx = makeTransaction({ creditCardId: undefined });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.card).toBe("");
  });

  it("leaves card blank when creditCardId does not resolve to a known card", () => {
    const tx = makeTransaction({ creditCardId: testId(999) });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.card).toBe("");
  });

  it("uses empty string when description is undefined", () => {
    const tx = makeTransaction({ description: undefined });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.description).toBe("");
  });

  it("formats amount to 2 decimal places", () => {
    const tx = makeTransaction({ amount: "1234.5" });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.amount).toBe("1234.50");
  });

  it("accepts date as a string (tRPC deserialization boundary)", () => {
    const tx = makeTransaction({
      date: "2026-06-16T10:00:00" as unknown as Date,
    });
    const row = transactionToExportRow(tx, categories, cards);
    expect(row.date).toBe("2026-06-16");
  });

  it("resolves income type correctly", () => {
    const incomeCat = makeCategory({
      id: testId(11),
      type: "income",
      name: "Salary",
    });
    const tx = makeTransaction({ type: "income", categoryId: testId(11) });
    const row = transactionToExportRow(tx, [incomeCat], []);
    expect(row.type).toBe("income");
    expect(row.category).toBe("Salary");
  });
});

describe("toTransactionCsv", () => {
  it("returns only the header row when given an empty array", () => {
    const result = toTransactionCsv([]);
    expect(result).toBe("Date,Type,Amount,Category,Card,Description");
  });

  it("produces header + one data row for a single entry", () => {
    const rows: ExportRow[] = [
      {
        date: "2026-06-16",
        type: "expense",
        amount: "50.00",
        category: "Food",
        card: "Visa Gold",
        description: "Coffee",
      },
    ];
    const result = toTransactionCsv(rows);
    const lines = result.split("\n");
    expect(lines[0]).toBe("Date,Type,Amount,Category,Card,Description");
    expect(lines[1]).toBe("2026-06-16,expense,50.00,Food,Visa Gold,Coffee");
    expect(lines).toHaveLength(2);
  });

  it("produces correct row count for 3 transactions (AC1 spec)", () => {
    const rows: ExportRow[] = [
      {
        date: "2026-06-01",
        type: "expense",
        amount: "10.00",
        category: "Food",
        card: "",
        description: "A",
      },
      {
        date: "2026-06-02",
        type: "income",
        amount: "500.00",
        category: "Salary",
        card: "",
        description: "B",
      },
      {
        date: "2026-06-03",
        type: "expense",
        amount: "25.00",
        category: "Food",
        card: "Visa Gold",
        description: "C",
      },
    ];
    const result = toTransactionCsv(rows);
    const lines = result.split("\n");
    expect(lines).toHaveLength(4); // header + 3 data
  });

  it("escapes fields with special characters (AC3 RFC-4180)", () => {
    const rows: ExportRow[] = [
      {
        date: "2026-06-16",
        type: "expense",
        amount: "1234.50",
        category: "Food",
        card: "",
        description: 'He said "hi", then left\n',
      },
    ];
    const result = toTransactionCsv(rows);
    expect(result).toContain('"He said ""hi"", then left\n"');
  });

  it("does not add thousands separators to large amounts", () => {
    const rows: ExportRow[] = [
      {
        date: "2026-01-01",
        type: "income",
        amount: "100000.00",
        category: "Salary",
        card: "",
        description: "",
      },
    ];
    const result = toTransactionCsv(rows);
    expect(result).toContain("100000.00");
    // No thousands separator — the amount should not appear as 100,000.00
    expect(result).not.toContain("100,000");
  });

  it("each data row has exactly 6 comma-delimited columns (AC1)", () => {
    const rows: ExportRow[] = [
      {
        date: "2026-06-01",
        type: "expense",
        amount: "5.00",
        category: "A,B",
        card: "",
        description: "",
      },
    ];
    const result = toTransactionCsv(rows);
    const dataLine = result.split("\n")[1];
    // Category has a comma so it's quoted — parse via simple RFC-4180 aware logic
    // The key check is that the unquoted commas total 5 (6 columns - 1)
    let inQuotes = false;
    let commaCount = 0;
    for (const ch of dataLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) commaCount++;
    }
    expect(commaCount).toBe(5);
  });
});
