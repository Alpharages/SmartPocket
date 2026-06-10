import { callDataApi } from "./_core/dataApi";
import { encryptCardNumber, isEncryptedCardNumber } from "./_core/crypto";

export type MigrationSummary = {
  total: number;
  encrypted: number;
  skipped: number;
  failed: number;
};

type CreditCardRow = {
  id: number;
  cardNumber: string;
};

export function formatMigrationSummary(summary: MigrationSummary): string {
  return `Card encryption migration: total=${summary.total} encrypted=${summary.encrypted} skipped=${summary.skipped} failed=${summary.failed}`;
}

/** Validates the encryption key before any database access or mutation. */
export function assertEncryptionKeyReady(): void {
  encryptCardNumber("__migration_key_probe__");
}

export async function migrateEncryptCardNumbers(): Promise<MigrationSummary> {
  assertEncryptionKeyReady();

  const result = await callDataApi("Database/query", {
    body: {
      query: "SELECT id, cardNumber FROM creditCards",
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
      const encrypted = encryptCardNumber(row.cardNumber);
      await callDataApi("Database/query", {
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
