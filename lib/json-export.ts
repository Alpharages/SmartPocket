export {
  transactionToJsonExportRow,
  type JsonExportRow,
} from "./export-mapping";
import type { JsonExportRow } from "./export-mapping";

export function toTransactionJson(
  rows: JsonExportRow[],
  opts: { currency: string },
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "SmartPocket",
      currency: opts.currency,
      count: rows.length,
      transactions: rows,
    },
    null,
    2,
  );
}
