import { dbQuery } from "./_core/db-query";
import { ulid } from "../shared/ulid";

/**
 * Phase 1 (local-first sync plan) data migration: backfill step.
 *
 * Runs between the two SQL migrations in `drizzle/`:
 *
 *   0011_ulid_shadow_columns.sql (expand) — adds nullable "*_ulid" shadow
 *   columns next to every existing int id/FK column.
 *   ↓ this script runs here ↓
 *   0012_ulid_ids_contract.sql (contract) — drops the int columns and
 *   renames the shadow columns to the canonical names.
 *
 * SQL alone cannot do this step: minting a ULID is application logic, not a
 * query. So every row in the five "referenced" tables (users, categories,
 * creditCards, accounts, loans — the tables other tables point at via a
 * foreign key) gets a fresh ULID written to its `id_ulid` column, and the
 * old-int-id → new-ULID mapping is kept in memory. Every table's FK shadow
 * columns are then rewritten using those maps.
 *
 * `users` must be backfilled first — every other table's `userId` depends on
 * its map. The other four referenced tables don't reference each other, so
 * they can run in any order relative to one another; the six "leaf" tables
 * (transactions, recurringTransactions, budgets, monthlySummaries,
 * repayments, transfers) run last since nothing depends on their ids.
 */

type Row = Record<string, unknown>;

async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
  const result = await dbQuery(sql, params);
  return Array.isArray(result) ? (result as Row[]) : [];
}

async function exec(sql: string, params: unknown[] = []): Promise<void> {
  await dbQuery(sql, params);
}

/**
 * Mints a ULID for every row of `table` and writes it to `id_ulid`.
 * Returns the old-id → new-id map, which downstream FK remaps consume.
 */
export async function assignUlidIds(
  table: string,
): Promise<Map<number, string>> {
  const rows = await query(`SELECT id FROM ${table}`);
  const map = new Map<number, string>();

  for (const row of rows) {
    const oldId = row.id as number;
    const newId = ulid();
    map.set(oldId, newId);
    await exec(`UPDATE ${table} SET id_ulid = ? WHERE id = ?`, [newId, oldId]);
  }

  return map;
}

export class OrphanForeignKeyError extends Error {
  constructor(
    public readonly table: string,
    public readonly column: string,
    public readonly rowId: number,
    public readonly danglingValue: number,
  ) {
    super(
      `${table}.${column} on row id=${rowId} references ${danglingValue}, ` +
        `which has no corresponding row in the referenced table. Refusing to ` +
        `migrate a dangling foreign key — investigate the source data before ` +
        `re-running.`,
    );
    this.name = "OrphanForeignKeyError";
  }
}

/**
 * Rewrites `${table}.${column}_ulid` for every row using `map` (built by an
 * earlier `assignUlidIds` call against the table `column` references).
 *
 * A `null` FK value (an optional link — `creditCardId`, `accountId`) is left
 * `null` rather than looked up; `nullable: true` is required to accept that.
 * A *non-null* value with no entry in `map` is a dangling foreign key — a row
 * pointing at something that no longer exists. Unlike the per-row-independent
 * failures in `migrate-encrypt-card-numbers.ts`, this is not something later
 * rows can be unaffected by: a corrupted FK graph is exactly the failure mode
 * ULIDs are being introduced to prevent, so this throws immediately rather
 * than silently producing a broken reference or skipping the row.
 */
export async function remapForeignKey(
  table: string,
  column: string,
  map: Map<number, string>,
  options: { nullable: boolean },
): Promise<number> {
  const rows = await query(`SELECT id, ${column} FROM ${table}`);
  let remapped = 0;

  for (const row of rows) {
    const rowId = row.id as number;
    const oldValue = row[column] as number | null;

    if (oldValue == null) {
      if (!options.nullable) {
        throw new Error(
          `${table}.${column} on row id=${rowId} is NULL but the column is ` +
            `declared NOT NULL in the schema — data is already inconsistent ` +
            `before this migration touches it.`,
        );
      }
      continue;
    }

    const newValue = map.get(oldValue);
    if (newValue === undefined) {
      throw new OrphanForeignKeyError(table, column, rowId, oldValue);
    }

    await exec(`UPDATE ${table} SET ${column}_ulid = ? WHERE id = ?`, [
      newValue,
      rowId,
    ]);
    remapped++;
  }

  return remapped;
}

export interface UlidMigrationSummary {
  /** Rows given a fresh id, per "referenced" table. */
  idsAssigned: Record<string, number>;
  /** FK columns rewritten, per "table.column". */
  foreignKeysRemapped: Record<string, number>;
}

/**
 * Runs the full backfill. Idempotent to re-run: `assignUlidIds` overwrites
 * `id_ulid` unconditionally, so a re-run mints fresh ids rather than reusing
 * ones from an aborted prior attempt — intentional, since a partially-applied
 * run's FK shadow columns cannot be trusted to still match.
 */
export async function migrateUlidIds(): Promise<UlidMigrationSummary> {
  const idsAssigned: Record<string, number> = {};
  const foreignKeysRemapped: Record<string, number> = {};

  const track = async (table: string) => {
    const map = await assignUlidIds(table);
    idsAssigned[table] = map.size;
    return map;
  };
  const remap = async (
    table: string,
    column: string,
    map: Map<number, string>,
    options: { nullable: boolean },
  ) => {
    const count = await remapForeignKey(table, column, map, options);
    foreignKeysRemapped[`${table}.${column}`] = count;
  };

  // Referenced tables first — order among these four doesn't matter, only
  // that `users` precedes all of them.
  const users = await track("users");
  const categories = await track("categories");
  const creditCards = await track("creditCards");
  const accounts = await track("accounts");
  const loans = await track("loans");

  await remap("categories", "userId", users, { nullable: false });
  await remap("creditCards", "userId", users, { nullable: false });
  await remap("accounts", "userId", users, { nullable: false });
  await remap("loans", "userId", users, { nullable: false });

  // Leaf tables: mint their own id, then remap every FK they carry.
  await track("transactions");
  await remap("transactions", "userId", users, { nullable: false });
  await remap("transactions", "categoryId", categories, { nullable: false });
  await remap("transactions", "creditCardId", creditCards, {
    nullable: true,
  });
  await remap("transactions", "accountId", accounts, { nullable: true });

  await track("recurringTransactions");
  await remap("recurringTransactions", "userId", users, { nullable: false });
  await remap("recurringTransactions", "categoryId", categories, {
    nullable: false,
  });
  await remap("recurringTransactions", "creditCardId", creditCards, {
    nullable: true,
  });

  await track("budgets");
  await remap("budgets", "userId", users, { nullable: false });
  await remap("budgets", "categoryId", categories, { nullable: false });

  await track("monthlySummaries");
  await remap("monthlySummaries", "userId", users, { nullable: false });

  await track("repayments");
  await remap("repayments", "loanId", loans, { nullable: false });
  await remap("repayments", "userId", users, { nullable: false });

  await track("transfers");
  await remap("transfers", "userId", users, { nullable: false });
  await remap("transfers", "fromAccountId", accounts, { nullable: false });
  await remap("transfers", "toAccountId", accounts, { nullable: false });

  return { idsAssigned, foreignKeysRemapped };
}

export function formatUlidMigrationSummary(
  summary: UlidMigrationSummary,
): string {
  const lines = ["ULID id migration — backfill complete.", "", "Ids assigned:"];
  for (const [table, count] of Object.entries(summary.idsAssigned)) {
    lines.push(`  ${table}: ${count}`);
  }
  lines.push("", "Foreign keys remapped:");
  for (const [key, count] of Object.entries(summary.foreignKeysRemapped)) {
    lines.push(`  ${key}: ${count}`);
  }
  lines.push(
    "",
    "Next: review these counts against the row counts you expect, then run",
    "the contract migration (drizzle/0012_ulid_ids_contract.sql) to drop the",
    "old integer columns and rename the shadow columns into place.",
  );
  return lines.join("\n");
}
