import { formatIsoDate } from "./date-utils";
import type { Category, CreditCard, Transaction } from "./expense-context";

export const CSV_IMPORT_FIELDS = [
  "date",
  "type",
  "amount",
  "category",
  "card",
  "description",
] as const;

export type CsvImportField = (typeof CSV_IMPORT_FIELDS)[number];
export type ColumnMap = Record<CsvImportField, number | null>;

export type ImportTransaction = Omit<
  Transaction,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export type InvalidImportRow = {
  rowIndex: number;
  reason: string;
};

export type ValidateRowResult =
  | { ok: true; value: ImportTransaction }
  | ({ ok: false } & InvalidImportRow);

const HEADER_ALIASES: Record<CsvImportField, string[]> = {
  date: ["date"],
  type: ["type"],
  amount: ["amount"],
  category: ["category"],
  card: ["card", "credit card", "creditcard"],
  description: ["description", "notes", "note"],
};

function blankMap(): ColumnMap {
  return {
    date: null,
    type: null,
    amount: null,
    category: null,
    card: null,
    description: null,
  };
}

export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const input = text.replace(/^\uFEFF/, "");
  if (input.trim() === "") {
    throw new Error("CSV file is empty");
  }

  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (field !== "") {
        throw new Error("Malformed CSV: unexpected quote");
      }
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      if (ch === "\r" && next === "\n") i++;
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unclosed quoted field");
  }

  row.push(field);
  if (row.some((cell) => cell !== "") || records.length === 0) {
    records.push(row);
  }

  const [headers, ...rows] = records;
  if (!headers?.some((cell) => cell.trim() !== "")) {
    throw new Error("CSV header row is empty");
  }

  return { headers: headers.map((h) => h.trim()), rows };
}

export function autoMapColumns(headers: string[]): ColumnMap {
  const map = blankMap();
  const normalized = headers.map((h) => h.trim().toLowerCase());

  for (const field of CSV_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field];
    const index = normalized.findIndex((header) => aliases.includes(header));
    map[field] = index >= 0 ? index : null;
  }

  return map;
}

function cell(row: string[], map: ColumnMap, field: CsvImportField): string {
  const index = map[field];
  return index == null ? "" : (row[index] ?? "").trim();
}

function parseImportDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return formatIsoDate(d) === value ? d : null;
  }

  const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const year = Number(parts[3]);

  const firstCanBeMonth = first >= 1 && first <= 12;
  const secondCanBeMonth = second >= 1 && second <= 12;

  let month: number;
  let day: number;
  if (firstCanBeMonth && secondCanBeMonth) {
    // Both MM/DD and DD/MM readings are plausible — refuse to guess unless they agree.
    if (first !== second) return null;
    month = first;
    day = second;
  } else if (firstCanBeMonth) {
    month = first;
    day = second;
  } else if (secondCanBeMonth) {
    month = second;
    day = first;
  } else {
    return null;
  }

  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
    ? d
    : null;
}

function normalizeAmount(value: string): string | null {
  if (value.includes(",")) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

export function validateRow(
  raw: string[],
  map: ColumnMap,
  context: {
    categories: Category[];
    creditCards: CreditCard[];
    rowIndex: number;
  },
): ValidateRowResult {
  for (const field of ["date", "type", "amount", "category"] as const) {
    if (map[field] == null) {
      return {
        ok: false,
        rowIndex: context.rowIndex,
        reason: `Missing ${field} column mapping`,
      };
    }
  }

  const date = parseImportDate(cell(raw, map, "date"));
  if (!date) {
    return { ok: false, rowIndex: context.rowIndex, reason: "Invalid date" };
  }

  const type = cell(raw, map, "type").toLowerCase();
  if (type !== "income" && type !== "expense") {
    return { ok: false, rowIndex: context.rowIndex, reason: "Invalid type" };
  }

  const amount = normalizeAmount(cell(raw, map, "amount"));
  if (!amount) {
    return { ok: false, rowIndex: context.rowIndex, reason: "Invalid amount" };
  }

  const categoryName = cell(raw, map, "category").toLowerCase();
  const categoriesByName = context.categories.filter(
    (c) => c.name.trim().toLowerCase() === categoryName,
  );
  const category = categoriesByName.find((c) => c.type === type);
  if (!category) {
    return {
      ok: false,
      rowIndex: context.rowIndex,
      reason:
        categoriesByName.length > 0
          ? "Category type does not match row type"
          : "Unknown category",
    };
  }

  const cardName = cell(raw, map, "card");
  const card = cardName
    ? context.creditCards.find(
        (c) => c.name.trim().toLowerCase() === cardName.toLowerCase(),
      )
    : undefined;
  if (cardName && !card) {
    return { ok: false, rowIndex: context.rowIndex, reason: "Unknown card" };
  }

  return {
    ok: true,
    value: {
      categoryId: category.id,
      creditCardId: card?.id,
      type,
      amount,
      description: cell(raw, map, "description") || undefined,
      date,
    },
  };
}

type DuplicateKeySource = Pick<
  Transaction,
  "date" | "type" | "amount" | "categoryId" | "description"
>;

/** Key on the same (date, type, amount, category, description) fields findDuplicate compares. */
export function duplicateKey(tx: DuplicateKeySource): string {
  return JSON.stringify([
    formatIsoDate(new Date(tx.date)),
    tx.type,
    Number(tx.amount).toFixed(2),
    tx.categoryId,
    tx.description ?? "",
  ]);
}

export function findDuplicate(
  candidate: ImportTransaction,
  existing: DuplicateKeySource[],
): boolean {
  const candidateKey = duplicateKey(candidate);
  return existing.some((tx) => duplicateKey(tx) === candidateKey);
}
