import { dbQuery } from "./_core/db-query";
import { encryptCardNumber, isEncryptedCardNumber } from "./_core/crypto";
import type { Id } from "../drizzle/schema";

export type MigrationSummary = {
  total: number;
  encrypted: number;
  skipped: number;
  failed: number;
};

type CreditCardRow = {
  id: Id;
  userId: Id;
  cardNumber: string;
};

export function formatMigrationSummary(summary: MigrationSummary): string {
  return `Card encryption migration: total=${summary.total} encrypted=${summary.encrypted} skipped=${summary.skipped} failed=${summary.failed}`;
}

export async function migrateEncryptCardNumbers(): Promise<MigrationSummary> {
  // There used to be an `assertEncryptionKeyReady()` probe here, encrypting a
  // dummy value up front so a misconfigured global CARD_ENCRYPTION_KEY failed
  // before the migration touched anything. That global precondition no longer
  // exists: keys are per-account and minted on demand
  // (server/_core/card-key.ts), so there is nothing to validate ahead of time
  // and a per-row failure is already counted in `summary.failed`.
  const result = await dbQuery("Database/query", {
    body: {
      query: "SELECT id, userId, cardNumber FROM creditCards",
      params: [],
    },
  });
  const rows = Array.isArray(result) ? (result as CreditCardRow[]) : [];

  const summary: MigrationSummary = {
    total: rows.length,
    encrypted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows) {
    if (isEncryptedCardNumber(row.cardNumber)) {
      summary.skipped++;
      continue;
    }

    try {
      const encrypted = await encryptCardNumber(row.cardNumber, row.userId);
      await dbQuery("Database/query", {
        body: {
          query: "UPDATE creditCards SET cardNumber = ? WHERE id = ?",
          params: [encrypted, row.id],
        },
      });
      summary.encrypted++;
    } catch {
      summary.failed++;
      console.error(`Card encryption migration failed for row id=${row.id}`);
    }
  }

  return summary;
}
