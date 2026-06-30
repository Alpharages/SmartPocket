import { formatIsoDate } from "./date-utils";
import type { Transaction, Category, CreditCard } from "./expense-context";

export interface ExportRow {
  date: string;
  type: string;
  amount: string;
  category: string;
  card: string;
  description: string;
}

/** RFC-4180: wrap field in double-quotes if it contains comma, quote, or newline; double any inner quotes. */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionToExportRow(
  tx: Transaction,
  categories: Category[],
  creditCards: CreditCard[],
): ExportRow {
  const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
  const category = categories.find((c) => c.id === tx.categoryId)?.name ?? "";
  const card = tx.creditCardId
    ? (creditCards.find((c) => c.id === tx.creditCardId)?.name ?? "")
    : "";
  return {
    date: formatIsoDate(d),
    type: tx.type,
    // amount magnitude; sign direction is captured in the type column
    amount: Number(tx.amount).toFixed(2),
    category,
    card,
    description: tx.description ?? "",
  };
}

const HEADER = "Date,Type,Amount,Category,Card,Description";

export function toTransactionCsv(rows: ExportRow[]): string {
  const dataLines = rows.map((r) =>
    [r.date, r.type, r.amount, r.category, r.card, r.description]
      .map(escapeCsvField)
      .join(","),
  );
  return [HEADER, ...dataLines].join("\n");
}
