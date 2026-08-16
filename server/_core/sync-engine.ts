import { getTableColumns } from "drizzle-orm";
import { callDataApi } from "./dataApi";
import * as schema from "../../drizzle/schema";
import type { Id, SyncTable } from "../../drizzle/schema";

/**
 * local-first-sync-plan.md phase 4: the sync worker's shared engine. Both
 * directions — a device pushing its dirty rows up, and a device applying
 * server-pulled rows down — are dynamic per-table upserts. Column names are
 * read off the drizzle schema (drizzle/schema.ts's comment: "Columns use
 * camelCase to match both database fields and generated types", so the JS
 * property name *is* the SQL column name — no mapping needed) rather than
 * hand-listed per table, so this module never drifts out of sync with the
 * schema the way a hand-maintained column list would.
 */
const SYNC_TABLE_OBJECTS: Record<SyncTable, unknown> = {
  categories: schema.categories,
  creditCards: schema.creditCards,
  accounts: schema.accounts,
  loans: schema.loans,
  budgets: schema.budgets,
  monthlySummaries: schema.monthlySummaries,
  transactions: schema.transactions,
  transfers: schema.transfers,
  recurringTransactions: schema.recurringTransactions,
  repayments: schema.repayments,
};

export function syncTableColumns(table: SyncTable): string[] {
  return Object.keys(getTableColumns(SYNC_TABLE_OBJECTS[table] as never));
}

/** Rows read off *this* side's data store that still need to reach the other side. */
export async function getDirtyRows(
  table: SyncTable,
  userId: Id,
  limit = 500,
): Promise<Record<string, unknown>[]> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `SELECT * FROM ${table} WHERE userId = ? AND dirty = 1 ORDER BY updatedAt ASC LIMIT ?`,
      params: [userId, limit],
    },
  });
  return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

/**
 * Server-only: hands out a contiguous block of `serverSeq` values. A single
 * multi-row INSERT into an AUTO_INCREMENT table gets a contiguous id block
 * under MySQL's default `innodb_autoinc_lock_mode` — `insertId` is the first
 * id in the block, so `insertId + i` is the seq for the i-th row pushed in
 * this batch. Atomic and connection-pool-safe without an explicit
 * transaction or a session-scoped `LAST_INSERT_ID()` call.
 */
export async function allocateServerSeqBlock(count: number): Promise<number> {
  if (count <= 0) return 0;
  const result = (await callDataApi("Database/query", {
    body: {
      query: `INSERT INTO syncSequence (createdAt) VALUES ${Array(count)
        .fill("(NOW())")
        .join(", ")}`,
      params: [],
    },
  })) as { insertId?: number };
  const firstSeq = result?.insertId;
  if (!firstSeq) {
    throw new Error("Failed to allocate a serverSeq block");
  }
  return firstSeq;
}

/**
 * Server-only: applies a batch of pushed rows for one table, forcing
 * `userId` to the authenticated caller (never trusting whatever the wire
 * payload claims) and assigning each row a fresh `serverSeq`. Returns the
 * assigned seq per row so the pushing device can mark its local copies clean.
 */
export async function applyPushedRows(
  table: SyncTable,
  userId: Id,
  rows: Record<string, unknown>[],
): Promise<Array<{ id: Id; serverSeq: number }>> {
  if (rows.length === 0) return [];

  const columns = syncTableColumns(table);
  const firstSeq = await allocateServerSeqBlock(rows.length);
  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = VALUES(${c})`)
    .join(", ");

  const results: Array<{ id: Id; serverSeq: number }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const serverSeq = firstSeq + i;
    const values = columns.map((c) => {
      if (c === "userId") return userId;
      if (c === "dirty") return false;
      if (c === "serverSeq") return serverSeq;
      return row[c];
    });

    await callDataApi("Database/query", {
      body: {
        query: `
          INSERT INTO ${table} (${columns.join(", ")})
          VALUES (${columns.map(() => "?").join(", ")})
          ON DUPLICATE KEY UPDATE ${updateClause}
        `,
        params: values,
      },
    });
    results.push({ id: row.id as Id, serverSeq });
  }
  return results;
}

/** Server-only: rows this user's account has above `sinceSeq`, oldest first. */
export async function getRowsSince(
  table: SyncTable,
  userId: Id,
  sinceSeq: number,
  limit = 500,
): Promise<Record<string, unknown>[]> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `SELECT * FROM ${table} WHERE userId = ? AND serverSeq > ? ORDER BY serverSeq ASC LIMIT ?`,
      params: [userId, sinceSeq, limit],
    },
  });
  return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

function rowUpdatedAtMs(row: Record<string, unknown>): number {
  const value = row.updatedAt;
  const date = value instanceof Date ? value : new Date(value as string);
  return date.getTime();
}

/**
 * Applies one row pulled from the other side into *this* side's data store —
 * used by a device applying server-pulled rows, and symmetric enough to
 * apply equally if the server ever needed to apply a row the other
 * direction. Last-write-wins on `updatedAt` (local-first-sync-plan.md's
 * documented conflict rule): a row edited locally after the incoming row was
 * last touched is left alone — it is still `dirty` and will win the next
 * push instead of being clobbered by a stale pull.
 */
export async function applyIncomingRow(
  table: SyncTable,
  incoming: Record<string, unknown>,
): Promise<"applied" | "skipped-local-newer"> {
  const columns = syncTableColumns(table);
  const existingRows = (await callDataApi("Database/query", {
    body: {
      query: `SELECT * FROM ${table} WHERE id = ?`,
      params: [incoming.id],
    },
  })) as Record<string, unknown>[];
  const existing = existingRows[0];

  if (existing && rowUpdatedAtMs(existing) > rowUpdatedAtMs(incoming)) {
    return "skipped-local-newer";
  }

  const updateClause = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = VALUES(${c})`)
    .join(", ");
  const values = columns.map((c) => (c === "dirty" ? false : incoming[c]));

  await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO ${table} (${columns.join(", ")})
        VALUES (${columns.map(() => "?").join(", ")})
        ON DUPLICATE KEY UPDATE ${updateClause}
      `,
      params: values,
    },
  });
  return "applied";
}

/** Marks previously-read dirty rows clean once the other side has acknowledged them. */
export async function markRowsSynced(
  table: SyncTable,
  updates: Array<{ id: Id; serverSeq: number }>,
): Promise<void> {
  for (const { id, serverSeq } of updates) {
    await callDataApi("Database/query", {
      body: {
        query: `UPDATE ${table} SET serverSeq = ?, dirty = 0 WHERE id = ?`,
        params: [serverSeq, id],
      },
    });
  }
}

/**
 * Client-only: local-first-sync-plan.md's "signing in later associates that
 * local user with the account" — every local row's `userId` points at the
 * device's synthetic local user (server/_core/local-context.ts), which is
 * never the account's own id. Re-owning is a one-time local rewrite: point
 * existing rows at the account's userId and mark them dirty so the very
 * next push attributes them to the account instead of the local device
 * identity. Used by the first-sync "keep this phone's data" and "merge"
 * choices.
 */
export async function reownLocalData(
  tables: readonly SyncTable[],
  fromUserId: Id,
  toUserId: Id,
): Promise<void> {
  for (const table of tables) {
    await callDataApi("Database/query", {
      body: {
        query: `UPDATE ${table} SET userId = ?, dirty = 1 WHERE userId = ?`,
        params: [toUserId, fromUserId],
      },
    });
  }
}

/**
 * Client-only: the first-sync "keep the account's data" choice — the local
 * device's pre-sync rows were never shared with anything else, so discarding
 * them is a hard delete, not a tombstone (there is nothing downstream that
 * could mistake "gone" for "not yet pulled").
 */
export async function discardLocalData(
  tables: readonly SyncTable[],
  userId: Id,
): Promise<void> {
  for (const table of tables) {
    await callDataApi("Database/query", {
      body: {
        query: `DELETE FROM ${table} WHERE userId = ?`,
        params: [userId],
      },
    });
  }
}

/** True if this user's account already holds any synced row, anywhere. */
export async function accountHasAnyData(
  tables: readonly SyncTable[],
  userId: Id,
): Promise<boolean> {
  for (const table of tables) {
    const result = await callDataApi("Database/query", {
      body: {
        query: `SELECT id FROM ${table} WHERE userId = ? AND deletedAt IS NULL LIMIT 1`,
        params: [userId],
      },
    });
    if (Array.isArray(result) && result.length > 0) return true;
  }
  return false;
}
