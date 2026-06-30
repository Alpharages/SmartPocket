export { transactionToExportRow, type ExportRow } from "./export-mapping";
import type { ExportRow } from "./export-mapping";

/** RFC-4180: wrap field in double-quotes if it contains comma, quote, or newline; double any inner quotes. */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
