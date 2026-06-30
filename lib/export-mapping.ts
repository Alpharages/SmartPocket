import { formatIsoDate } from "./date-utils";
import type { Category, CreditCard, Transaction } from "./expense-context";

export interface ExportRow {
  date: string;
  type: "income" | "expense";
  amount: string;
  category: string;
  card: string;
  description: string;
}

export interface JsonExportRow {
  id: number;
  date: string;
  type: "income" | "expense";
  amount: string;
  category: Pick<Category, "id" | "name" | "type" | "color" | "icon">;
  card: Pick<CreditCard, "id" | "name"> | null;
  description: string;
}

function baseFields(tx: Transaction) {
  const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
  return {
    date: formatIsoDate(d),
    type: tx.type,
    // Story 10.3 importer contract: date/type/amount/category/card/description
    // match CSV cells 1:1; amount is magnitude as a fixed string, sign lives in type.
    amount: Number(tx.amount).toFixed(2),
    description: tx.description ?? "",
  };
}

export function transactionToJsonExportRow(
  tx: Transaction,
  categories: Category[],
  creditCards: CreditCard[],
): JsonExportRow {
  const category = categories.find((c) => c.id === tx.categoryId);
  const card = tx.creditCardId
    ? creditCards.find((c) => c.id === tx.creditCardId)
    : undefined;

  return {
    id: tx.id,
    ...baseFields(tx),
    category: {
      id: tx.categoryId,
      name: category?.name ?? "",
      type: category?.type ?? tx.type,
      color: category?.color ?? "",
      icon: category?.icon ?? "",
    },
    card: card ? { id: card.id, name: card.name } : null,
  };
}

export function transactionToExportRow(
  tx: Transaction,
  categories: Category[],
  creditCards: CreditCard[],
): ExportRow {
  const row = transactionToJsonExportRow(tx, categories, creditCards);
  return {
    date: row.date,
    type: row.type,
    amount: row.amount,
    category: row.category.name,
    card: row.card?.name ?? "",
    description: row.description,
  };
}
