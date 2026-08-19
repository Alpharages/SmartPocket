import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callDataApi } from "./_core/dataApi";
import { migrateUlidIds, formatUlidMigrationSummary } from "./migrate-ulid-ids";
import { backfillServerSeq } from "./_core/sync-engine";
import { reencryptLegacyCardNumbers } from "./_core/card-key";
import { parseLegacyCardKey } from "./_core/crypto";
import { SYNC_TABLES } from "../drizzle/schema";

/**
 * Phase 1 (local-first sync plan) server migration, start to finish.
 *
 * The four SQL files this runs are deliberately absent from
 * `drizzle/meta/_journal.json`, so `drizzle-kit migrate` (and therefore
 * `pnpm db:push`) skips them entirely. That is not an oversight to be fixed
 * by adding journal entries: `0012_ulid_ids_contract.sql` must run *after*
 * `migrate-ulid-ids.ts` has minted a ULID for every row, and drizzle-kit has
 * no way to interleave application code between two SQL files. Journaling
 * them would make `pnpm db:push` run the contract step against un-backfilled
 * shadow columns and drop every id in the database.
 *
 * So the ordering lives here instead, as one re-runnable command:
 *
 *   0011 expand   → add nullable `*_ulid` shadow columns + the sync columns
 *   backfill      → mint ULIDs, remap every foreign key (application code)
 *   verify        → refuse to contract while any shadow column is still NULL
 *   0012 contract → drop the int columns, rename the shadow columns in
 *   0013 / 0014   → the sync sequence and purge-watermark tables
 *
 * Every step is guarded by a state check rather than a ledger, so running
 * this twice is a no-op and running it against a half-migrated database
 * resumes from wherever it stopped.
 */

export type Phase1Step = {
  name: string;
  status: "applied" | "already-applied";
  detail?: string;
};

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await callDataApi("Database/query", {
    body: { query: sql, params },
  });
  return Array.isArray(result) ? (result as T[]) : [];
}

/** Splits a migration file into individual statements, dropping comments. */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function runSqlFile(file: string): Promise<void> {
  const path = join(process.cwd(), "drizzle", file);
  for (const statement of splitSqlStatements(readFileSync(path, "utf8"))) {
    await callDataApi("Database/query", {
      body: { query: statement, params: [] },
    });
  }
}

async function columnType(
  table: string,
  column: string,
): Promise<string | null> {
  const rows = await query<{ DATA_TYPE?: string; data_type?: string }>(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const row = rows[0];
  if (!row) return null;
  return (row.DATA_TYPE ?? row.data_type ?? null) as string | null;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await query(
    `SELECT 1 AS present FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.length > 0;
}

/**
 * Tables whose `id` the backfill mints, paired with every column that has to
 * be non-NULL before the contract step is allowed to drop the int originals.
 * A NULL here means the backfill did not finish — contracting anyway would
 * turn a dangling reference into a permanently lost one.
 */
const BACKFILL_CHECKS: Record<string, string[]> = {
  users: ["id_ulid"],
  categories: ["id_ulid", "userId_ulid"],
  creditCards: ["id_ulid", "userId_ulid"],
  accounts: ["id_ulid", "userId_ulid"],
  loans: ["id_ulid", "userId_ulid"],
  transactions: ["id_ulid", "userId_ulid", "categoryId_ulid"],
  recurringTransactions: ["id_ulid", "userId_ulid", "categoryId_ulid"],
  budgets: ["id_ulid", "userId_ulid", "categoryId_ulid"],
  monthlySummaries: ["id_ulid", "userId_ulid"],
  repayments: ["id_ulid", "userId_ulid", "loanId_ulid"],
  transfers: ["id_ulid", "userId_ulid"],
};

export class BackfillIncompleteError extends Error {
  constructor(public readonly gaps: string[]) {
    super(
      `Refusing to run the contract migration — the ULID backfill left NULLs in:\n` +
        gaps.map((g) => `  ${g}`).join("\n") +
        `\n\nRe-run the backfill (pnpm db:migrate:ulid-ids) and check its summary ` +
        `before continuing. Contracting now would drop the int ids these rows ` +
        `still depend on.`,
    );
  }
}

/** Every `<table>.<column>` the backfill was supposed to fill but did not. */
async function findBackfillGaps(): Promise<string[]> {
  const gaps: string[] = [];
  for (const [table, columns] of Object.entries(BACKFILL_CHECKS)) {
    for (const column of columns) {
      // A nullable FK (a transaction with no card) is legitimately NULL in
      // both the int and the shadow column — only a shadow that is NULL
      // while its int source is not indicates an unfinished backfill.
      const source = column.replace(/_ulid$/, "");
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${source} IS NOT NULL AND ${column} IS NULL`,
      );
      const missing = Number(rows[0]?.n ?? 0);
      if (missing > 0) gaps.push(`${table}.${column} (${missing} row(s))`);
    }
  }
  return gaps;
}

export async function migratePhase1(): Promise<Phase1Step[]> {
  const steps: Phase1Step[] = [];

  // `users.id` being a varchar means the contract step has already run, and
  // with it everything before it. Checked before anything else because the
  // contract step *renames `id_ulid` to `id`* — so the obvious "has the
  // expand step run?" marker (does `users.id_ulid` exist?) reads false again
  // once the migration is complete, and re-running the expand step on a
  // finished database fails on a duplicate column.
  const alreadyContracted = (await columnType("users", "id")) === "varchar";

  if (alreadyContracted) {
    steps.push({ name: "0011 expand (shadow + sync columns)", status: "already-applied" });
    steps.push({ name: "ULID backfill", status: "already-applied" });
    steps.push({ name: "0012 contract (drop int ids)", status: "already-applied" });
  } else {
    // Step 1 — expand. `users.id_ulid` existing is the marker, and is only
    // meaningful while the database is still on int ids.
    if (await columnType("users", "id_ulid")) {
      steps.push({ name: "0011 expand (shadow + sync columns)", status: "already-applied" });
    } else {
      await runSqlFile("0011_ulid_shadow_columns.sql");
      steps.push({ name: "0011 expand (shadow + sync columns)", status: "applied" });
    }

    const summary = await migrateUlidIds();
    steps.push({
      name: "ULID backfill",
      status: "applied",
      detail: formatUlidMigrationSummary(summary),
    });

    const gaps = await findBackfillGaps();
    if (gaps.length > 0) throw new BackfillIncompleteError(gaps);

    await runSqlFile("0012_ulid_ids_contract.sql");
    steps.push({ name: "0012 contract (drop int ids)", status: "applied" });
  }

  // Steps 5-7 — the sync tables. Additive and independent of the id change.
  for (const [table, file] of [
    ["syncSequence", "0013_sync_sequence.sql"],
    ["syncPurgeWatermark", "0014_sync_purge_watermark.sql"],
    ["users_cardKey", "0015_user_card_key.sql"],
  ] as const) {
    const present =
      table === "users_cardKey"
        ? (await columnType("users", "cardKey")) !== null
        : await tableExists(table);
    if (present) {
      steps.push({ name: `${file} (${table})`, status: "already-applied" });
    } else {
      await runSqlFile(file);
      steps.push({ name: `${file} (${table})`, status: "applied" });
    }
  }

  // Step 8 — give every pre-existing row a serverSeq.
  //
  // This is the step whose absence is silent and total: a pull is
  // `WHERE serverSeq > ?`, and `NULL > 0` is not true in SQL, so without it
  // every row an existing user had before sync shipped is invisible to every
  // device, forever. Runs last, after the sync sequence table exists, and is
  // a no-op once every row has a seq.
  const backfilled = await backfillServerSeq(SYNC_TABLES);
  const backfilledTotal = Object.values(backfilled).reduce((a, b) => a + b, 0);
  steps.push({
    name: "serverSeq backfill (makes pre-sync rows pullable)",
    status: backfilledTotal > 0 ? "applied" : "already-applied",
    detail:
      backfilledTotal > 0
        ? Object.entries(backfilled)
            .map(([table, count]) => `${table}: ${count}`)
            .join("\n")
        : undefined,
  });

  // Step 9 — move any card still under the old global env key onto its
  // owner's account key. The server can read those rows either way; devices
  // cannot read them at all, and only find out when someone opens the card.
  const cards = await reencryptLegacyCardNumbers(parseLegacyCardKey());
  steps.push({
    name: "card re-encryption (account key, so devices can read them)",
    status: cards.converted > 0 ? "applied" : "already-applied",
    detail:
      cards.converted > 0 || cards.unreadable > 0
        ? `converted: ${cards.converted}, already current: ${cards.alreadyCurrent}, unreadable: ${cards.unreadable}`
        : undefined,
  });

  return steps;
}

export function formatPhase1Summary(steps: Phase1Step[]): string {
  const lines = ["Phase 1 server migration:"];
  for (const step of steps) {
    lines.push(
      `  ${step.status === "applied" ? "✓ ran" : "· skipped (already applied)"} — ${step.name}`,
    );
    if (step.detail) {
      lines.push(...step.detail.split("\n").map((l) => `      ${l}`));
    }
  }
  return lines.join("\n");
}
