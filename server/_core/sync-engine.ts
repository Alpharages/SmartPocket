import { TRPCError } from "@trpc/server";
import { getTableColumns } from "drizzle-orm";
import { dbQuery } from "./db-query";
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
  const result = await dbQuery("Database/query", {
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
  const result = (await dbQuery("Database/query", {
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
 * Server-only: refuses a push batch that targets a row belonging to another
 * account.
 *
 * `applyPushedRows` already forces `userId` to the caller, which stops a
 * device *claiming* another account on a row it creates. But the write is an
 * `INSERT ... ON DUPLICATE KEY UPDATE` keyed on the client-supplied `id`, and
 * MySQL has no `WHERE` clause on the update half — so a push carrying an id
 * that already exists under someone else's account overwrote that row *and*
 * moved it to the pusher (`userId = VALUES(userId)`). The victim's row simply
 * vanishes from their side. ULIDs are not guessable, but authorization must
 * not rest on that.
 *
 * One query for the whole batch, before any write, so a batch mixing
 * legitimate rows with a hijack attempt lands none of them.
 */
async function assertRowsOwnedByCaller(
  table: SyncTable,
  userId: Id,
  rows: Record<string, unknown>[],
): Promise<void> {
  const ids = rows.map((row) => row.id).filter((id) => typeof id === "string");
  if (ids.length === 0) return;

  const foreign = await dbQuery("Database/query", {
    body: {
      query: `SELECT id FROM ${table} WHERE id IN (${ids
        .map(() => "?")
        .join(", ")}) AND userId <> ?`,
      params: [...ids, userId],
    },
  });

  if (Array.isArray(foreign) && foreign.length > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Push rejected: ${table} row ${
        (foreign[0] as { id: string }).id
      } belongs to another account`,
    });
  }
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

  await assertRowsOwnedByCaller(table, userId, rows);

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

    await dbQuery("Database/query", {
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

/**
 * Server-only: gives a `serverSeq` to every row that was written *on the
 * server* since the last pull, so devices can see it.
 *
 * The web client is a first-class client that writes straight to MySQL
 * through `server/db.ts` — it has no local SQLite and no push step. Those
 * writes stamp `dirty = 1` (see TOUCH_SET / TOMBSTONE_SET) but leave
 * `serverSeq` on whatever value it already had, and a pull is
 * `WHERE serverSeq > cursor`. So an edit or a delete made on the web was
 * invisible to every phone on the account, permanently: the row's seq was
 * already behind every device's cursor. A deletion is the worst case — the
 * row simply stays alive on every device forever.
 *
 * `dirty = 1` is exactly the right marker here. On a device it means "not yet
 * pushed", but on the server nothing pushes *from* here, so the only thing
 * that sets it is a local write — and `applyPushedRows` clears it on
 * everything arriving from a device. Sequencing those rows and clearing the
 * flag turns a server-side write into an ordinary pullable change.
 */
export async function sequenceServerWrites(
  tables: readonly SyncTable[],
  userId: Id,
): Promise<number> {
  let sequenced = 0;

  for (const table of tables) {
    const rows = (await dbQuery("Database/query", {
      body: {
        query: `SELECT id FROM ${table} WHERE userId = ? AND dirty = 1 ORDER BY updatedAt ASC`,
        params: [userId],
      },
    })) as Array<{ id: Id }>;

    if (rows.length === 0) continue;

    const firstSeq = await allocateServerSeqBlock(rows.length);
    for (let i = 0; i < rows.length; i++) {
      await dbQuery("Database/query", {
        body: {
          query: `UPDATE ${table} SET serverSeq = ?, dirty = 0 WHERE id = ?`,
          params: [firstSeq + i, rows[i].id],
        },
      });
    }
    sequenced += rows.length;
  }

  return sequenced;
}

/**
 * Server-only: the highest `serverSeq` handed out so far, across every table.
 *
 * A pull cycle reads this *before* it starts and uses it as the cursor it
 * advances to afterwards. Advancing to the highest seq actually *seen* is
 * what the naive version did, and it silently drops rows: the tables are
 * pulled one after another, so a row written to an already-pulled table
 * while a later table is still being pulled gets a seq below the
 * cycle's high-water mark and is never fetched again. Reading the head up
 * front means anything written during the cycle sorts above the cursor and
 * is picked up by the next one.
 */
export async function getHeadSeq(): Promise<number> {
  const rows = (await dbQuery("Database/query", {
    body: { query: "SELECT MAX(seq) AS head FROM syncSequence", params: [] },
  })) as Array<{ head: number | null }>;
  return rows[0]?.head ?? 0;
}

/**
 * Server-only: gives every row that has never been assigned a `serverSeq` one.
 *
 * A pull is `WHERE serverSeq > ?`, and in SQL `NULL > 0` is not true — so a
 * row with no seq is invisible to every pull, on every device, forever. Rows
 * only get a seq by being *pushed* (`applyPushedRows`), which means every row
 * that already existed server-side before sync shipped — everything an
 * existing user has ever entered — is unreachable until it is given one.
 *
 * Runs as part of the phase 1 migration (server/migrate-phase1.ts). Seqs come
 * from the same `syncSequence` allocator every push uses, so the backfilled
 * rows sort before anything written afterwards and a device pulls them
 * exactly once, in one pass, like any other batch.
 */
export async function backfillServerSeq(
  tables: readonly SyncTable[],
): Promise<Record<string, number>> {
  const assigned: Record<string, number> = {};

  for (const table of tables) {
    const rows = (await dbQuery("Database/query", {
      body: {
        query: `SELECT id FROM ${table} WHERE serverSeq IS NULL ORDER BY id ASC`,
        params: [],
      },
    })) as Array<{ id: Id }>;

    if (rows.length === 0) continue;

    const firstSeq = await allocateServerSeqBlock(rows.length);
    for (let i = 0; i < rows.length; i++) {
      await dbQuery("Database/query", {
        body: {
          // `dirty` is a client-side concept — a row sitting on the server is
          // by definition not pending upload. These rows carry the column
          // default (1) simply because nothing ever wrote them through the
          // sync path.
          query: `UPDATE ${table} SET serverSeq = ?, dirty = 0 WHERE id = ?`,
          params: [firstSeq + i, rows[i].id],
        },
      });
    }
    assigned[table] = rows.length;
  }

  return assigned;
}

/** Server-only: rows this user's account has above `sinceSeq`, oldest first. */
export async function getRowsSince(
  table: SyncTable,
  userId: Id,
  sinceSeq: number,
  limit = 500,
): Promise<Record<string, unknown>[]> {
  const result = await dbQuery("Database/query", {
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
  const existingRows = (await dbQuery("Database/query", {
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

  await dbQuery("Database/query", {
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
    await dbQuery("Database/query", {
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
    await dbQuery("Database/query", {
      body: {
        query: `UPDATE ${table} SET userId = ?, dirty = 1 WHERE userId = ?`,
        params: [toUserId, fromUserId],
      },
    });
  }
}

/**
 * Client-only: marks every one of this user's local rows dirty again,
 * regardless of their current state. Used by the stale-cursor "keep this
 * device's data" choice — this device's rows are already owned by the
 * account (a prior sync re-owned them), so there's nothing to reown, just a
 * need to re-push everything as canonical after the account's current data
 * has been wiped (lib/sync/sync-worker.ts's resolveStaleCursor).
 */
export async function markAllDirty(
  tables: readonly SyncTable[],
  userId: Id,
): Promise<void> {
  for (const table of tables) {
    await dbQuery("Database/query", {
      body: {
        query: `UPDATE ${table} SET dirty = 1 WHERE userId = ?`,
        params: [userId],
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
    await dbQuery("Database/query", {
      body: {
        query: `DELETE FROM ${table} WHERE userId = ?`,
        params: [userId],
      },
    });
  }
}

/**
 * Rows the app creates for a user without being asked — `ensureUserSeeded`
 * gives every new user a set of default categories and a "Cash" account,
 * both flagged `isDefault`. They are not data the user has *entered*, so
 * they must not count as "this side already holds data": counting them made
 * a brand-new phone report a conflict against every account, pushing the
 * first-sync prompt (and its destructive "keep this phone's data" option) in
 * front of a user who had nothing to lose or choose between. Symmetric —
 * an account holding only its own seeded defaults is just as empty.
 */
const SEEDED_DEFAULT_TABLES: ReadonlySet<string> = new Set([
  "categories",
  "accounts",
]);

/** True if this user's account already holds any synced row, anywhere. */
export async function accountHasAnyData(
  tables: readonly SyncTable[],
  userId: Id,
): Promise<boolean> {
  for (const table of tables) {
    const ignoreSeeded = SEEDED_DEFAULT_TABLES.has(table)
      ? " AND isDefault = 0"
      : "";
    const result = await dbQuery("Database/query", {
      body: {
        query: `SELECT id FROM ${table} WHERE userId = ? AND deletedAt IS NULL${ignoreSeeded} LIMIT 1`,
        params: [userId],
      },
    });
    if (Array.isArray(result) && result.length > 0) return true;
  }
  return false;
}

// ============================================================================
// TOMBSTONE PURGE (local-first-sync-plan.md "Purging tombstones" open risk)
// ============================================================================

const PURGE_WATERMARK_ID = 1;

/**
 * Server-only: the highest `serverSeq` the purge job has ever swept.
 * `lib/sync/sync-worker.ts` compares this to a device's own pull cursor —
 * a device behind this value can no longer trust an incremental pull to
 * have carried every tombstone it needed.
 */
export async function getPurgeWatermark(): Promise<number> {
  const rows = (await dbQuery("Database/query", {
    body: {
      query: "SELECT purgedUpToSeq FROM syncPurgeWatermark WHERE id = ?",
      params: [PURGE_WATERMARK_ID],
    },
  })) as Array<{ purgedUpToSeq: number }>;
  return rows[0]?.purgedUpToSeq ?? 0;
}

/**
 * Server-only: hard-deletes tombstoned rows older than `olderThan` across
 * every synced table, then advances the purge watermark to the highest
 * `serverSeq` among the rows it just removed (never backwards — two
 * concurrent runs, or a run that finds nothing, must not lower it). Safe to
 * call on any schedule: the watermark is what makes an *arbitrary* schedule
 * safe, by turning "purged too early" into a detectable stale-cursor
 * condition instead of a silent resurrection.
 */
export async function purgeOldTombstones(
  tables: readonly SyncTable[],
  olderThan: Date,
): Promise<{ purgedCount: number; newWatermark: number }> {
  let purgedCount = 0;
  let maxSeqSeen = await getPurgeWatermark();

  for (const table of tables) {
    const candidates = (await dbQuery("Database/query", {
      body: {
        query: `SELECT id, serverSeq FROM ${table} WHERE deletedAt IS NOT NULL AND deletedAt < ?`,
        params: [olderThan],
      },
    })) as Array<{ id: string; serverSeq: number | null }>;

    if (candidates.length === 0) continue;

    for (const candidate of candidates) {
      if (
        typeof candidate.serverSeq === "number" &&
        candidate.serverSeq > maxSeqSeen
      ) {
        maxSeqSeen = candidate.serverSeq;
      }
    }

    await dbQuery("Database/query", {
      body: {
        query: `DELETE FROM ${table} WHERE deletedAt IS NOT NULL AND deletedAt < ?`,
        params: [olderThan],
      },
    });
    purgedCount += candidates.length;
  }

  await dbQuery("Database/query", {
    body: {
      query:
        "UPDATE syncPurgeWatermark SET purgedUpToSeq = ? WHERE id = ? AND purgedUpToSeq < ?",
      params: [maxSeqSeen, PURGE_WATERMARK_ID, maxSeqSeen],
    },
  });

  return { purgedCount, newWatermark: maxSeqSeen };
}
