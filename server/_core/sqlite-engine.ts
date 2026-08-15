import {
  DEFAULT_NOW_COLUMNS,
  SQLITE_DATE_COLUMNS,
  SQLITE_MIGRATIONS,
  UPSERT_CONFLICT_COLUMN,
} from "./sqlite-schema";

/**
 * The local data engine — everything `dataApi.native.ts` needs to answer a
 * `callDataApi("Database/query", ...)` call against on-device SQLite,
 * factored out from any concrete SQLite binding.
 *
 * `server/db.ts` was written against `mysql2`'s query/param/result shapes
 * (an array of rows for a SELECT, `{ insertId, affectedRows }` for a write,
 * `Date` objects for timestamp columns, `?` placeholders). Every function
 * here exists to make a real SQLite engine answer in exactly that shape, so
 * `server/db.ts` runs unmodified against either backend — the whole premise
 * of the plan's "one data path."
 *
 * Nothing in this file imports a SQLite binding. `SqliteDriver` is the seam:
 * `sqlite-node-driver.ts` implements it over `node:sqlite` (used by every
 * test in this file, and available for a future Node-hosted dev harness),
 * `dataApi.native.ts` implements it over `expo-sqlite` for the real app.
 * Testing the translation and marshaling logic here against a genuine SQLite
 * engine is far stronger evidence than testing it against a hand-rolled
 * fake would be — the DDL, the rewritten SQL, and the round-tripped values
 * all have to actually parse and execute correctly.
 */

export type Row = Record<string, unknown>;

export interface SqliteWriteResult {
  changes: number;
}

/**
 * The minimal surface `sqlite-engine.ts` needs from a concrete SQLite
 * binding. Every method is async so a single call site works whether the
 * underlying binding is sync (`node:sqlite`, `expo-sqlite`'s `*Sync`
 * methods) or genuinely async (`expo-sqlite`'s `*Async` methods, which the
 * real app uses so a query never blocks the JS thread).
 */
export interface SqliteDriver {
  /** Runs a (possibly multi-statement) DDL script. Used only for migrations. */
  execScript(sql: string): Promise<void>;
  /** Runs an INSERT/UPDATE/DELETE and reports how many rows it touched. */
  run(sql: string, params: unknown[]): Promise<SqliteWriteResult>;
  /** Runs a SELECT and returns every matching row. */
  selectAll(sql: string, params: unknown[]): Promise<Row[]>;
  getUserVersion(): Promise<number>;
  setUserVersion(version: number): Promise<void>;
}

/**
 * Brings a database from whatever `user_version` it is currently at up to
 * `SQLITE_MIGRATIONS.length`, running each not-yet-applied script in order.
 * Safe to call on every app launch — a fully migrated database is a no-op.
 */
export async function runMigrations(driver: SqliteDriver): Promise<void> {
  const current = await driver.getUserVersion();
  for (let version = current; version < SQLITE_MIGRATIONS.length; version++) {
    await driver.execScript(SQLITE_MIGRATIONS[version]);
    await driver.setUserVersion(version + 1);
  }
}

/**
 * Converts one bound parameter value into something SQLite's binder accepts.
 * SQLite has exactly four storage classes (NULL, INTEGER, REAL, TEXT, BLOB —
 * five, but nothing here ever binds a BLOB); a raw JS `boolean` or `Date`
 * bound directly throws. This is a value-level conversion, not a column-level
 * one — no lookup table is needed on the way in because a `Date` is
 * self-describing as "this needs to become an ISO string" regardless of
 * which column it's headed for.
 */
function marshalValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function marshalParams(params: unknown[]): unknown[] {
  return params.map(marshalValue);
}

/**
 * Converts one result row's date-shaped columns back into `Date` instances,
 * matching what `mysql2` hands `server/db.ts` for a MySQL `timestamp` column.
 * Boolean columns need no conversion the other way: SQLite already stores
 * and returns 0/1 for them, identical to what `mysql2` returns for MySQL's
 * `tinyint(1)` — `coerceDbBoolean` in `server/db.ts` already expects exactly
 * that shape.
 */
function unmarshalRow(row: Row): Row {
  const result: Row = {};
  for (const [column, value] of Object.entries(row)) {
    if (typeof value === "string" && SQLITE_DATE_COLUMNS.has(column)) {
      result[column] = new Date(value);
    } else {
      result[column] = value;
    }
  }
  return result;
}

/**
 * Rewrites one `INSERT ... ON DUPLICATE KEY UPDATE ...` statement (MySQL
 * upsert syntax) into SQLite's `INSERT ... ON CONFLICT (...) DO UPDATE SET
 * ...`. Structural, not a token substitution — MySQL resolves the conflicting
 * constraint implicitly, so the target column has to be supplied from
 * `UPSERT_CONFLICT_COLUMN` rather than recovered from the query text. Each
 * `col = VALUES(col)` assignment (the value that would have been inserted)
 * becomes `col = excluded.col`, SQLite's name for the same thing.
 */
function rewriteUpsert(sql: string): string {
  const match = sql.match(
    /^(\s*INSERT INTO\s+(\w+)\s*\([^)]+\)\s*VALUES\s*\([^)]+\))\s*ON DUPLICATE KEY UPDATE\s*([\s\S]+?)\s*$/i,
  );
  if (!match) return sql;

  const [, insertClause, table, updateClause] = match;
  const conflictColumn = UPSERT_CONFLICT_COLUMN[table];
  if (!conflictColumn) {
    throw new Error(
      `sqlite-engine: no ON CONFLICT column configured for table "${table}" ` +
        `— add an entry to UPSERT_CONFLICT_COLUMN in sqlite-schema.ts.`,
    );
  }

  const rewrittenUpdates = updateClause.replace(
    /(\w+)\s*=\s*VALUES\((\w+)\)/gi,
    "$1 = excluded.$2",
  );

  return `${insertClause} ON CONFLICT (${conflictColumn}) DO UPDATE SET ${rewrittenUpdates}`;
}

/**
 * Rewrites `NOW()` to a bound parameter carrying the current instant as the
 * same ISO-8601 text every other date value is marshaled to. Textually
 * replacing it with SQLite's `CURRENT_TIMESTAMP` was considered and
 * rejected: that function renders as `"YYYY-MM-DD HH:MM:SS"` (space
 * separator, no fractional seconds), which does not sort correctly against
 * this codebase's `"YYYY-MM-DDTHH:MM:SS.sssZ"` date strings — `'T'` (0x54)
 * sorts after `' '` (0x20), so a stored date exactly "now" would compare as
 * greater than `CURRENT_TIMESTAMP` even though the instants are equal,
 * silently breaking `findActiveBudget`'s active-window check. Binding a
 * parameter in the app's own format sidesteps the mismatch entirely.
 *
 * A single pass left-to-right over the SQL text, rebuilding the params array
 * in lockstep, so a `NOW()` occurring before an existing `?` placeholder
 * doesn't desync every placeholder after it — appending the new param at the
 * end of the array would do exactly that whenever `NOW()` isn't the last
 * placeholder in the statement (see `findActiveBudget`, which has a
 * caller-supplied `excludeId` placeholder after both `NOW()`s).
 */
function rewriteNow(
  sql: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  if (!sql.includes("NOW()")) return { sql, params };

  const now = new Date().toISOString();
  let out = "";
  let paramIndex = 0;
  const outParams: unknown[] = [];

  for (let i = 0; i < sql.length; ) {
    if (sql.startsWith("NOW()", i)) {
      out += "?";
      outParams.push(now);
      i += "NOW()".length;
      continue;
    }
    if (sql[i] === "?") {
      out += "?";
      outParams.push(params[paramIndex++]);
      i += 1;
      continue;
    }
    out += sql[i];
    i += 1;
  }

  return { sql: out, params: outParams };
}

/**
 * Adds any of `DEFAULT_NOW_COLUMNS[table]` missing from an `INSERT`'s column
 * list, binding the same fresh `Date` for every row — see the doc comment on
 * `DEFAULT_NOW_COLUMNS` for why this exists. A no-op for every statement that
 * already lists all of them, or that isn't a plain
 * `INSERT INTO table (...) VALUES (...)` at all.
 *
 * Handles both the single-row insert every `create*` function in
 * `server/db.ts` emits and `createTransactionsBulk`'s multi-row
 * `VALUES (?, ...), (?, ...), ...` — both omit these columns for the same
 * reason (there is no per-row MySQL `DEFAULT` to lean on either way). Every
 * `VALUES` clause across the whole codebase is built from `?` placeholders
 * only (never a literal alongside them — confirmed by grep, not assumed), so
 * the entire clause is safe to discard and regenerate from the column count
 * and `params.length` rather than textually parsed row-by-row.
 */
function injectMissingTimestamps(
  sql: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  // The tuple group matches one-or-more `(...)` value groups, comma
  // separated, so `suffix` captures only whatever follows them — critically,
  // `upsertUser`'s trailing `ON DUPLICATE KEY UPDATE ...` clause, which a
  // greedy `[\s\S]+$` on the tuples themselves would otherwise swallow and
  // silently discard.
  const match = sql.match(
    /^(\s*INSERT INTO\s+(\w+)\s*)\(([^)]+)\)\s*VALUES\s*((?:\([^)]*\)\s*,?\s*)+)([\s\S]*)$/i,
  );
  if (!match) return { sql, params };

  const [, prefix, table, columnsRaw, , suffix] = match;
  const defaultable = DEFAULT_NOW_COLUMNS[table];
  if (!defaultable) return { sql, params };

  const columns = columnsRaw.split(",").map((c) => c.trim());
  const missing = defaultable.filter((c) => !columns.includes(c));
  if (missing.length === 0) return { sql, params };

  const columnCount = columns.length;
  if (params.length === 0 || params.length % columnCount !== 0) {
    throw new Error(
      `sqlite-engine: cannot inject default timestamps for "${table}" — ` +
        `${params.length} params is not a multiple of its ${columnCount} columns.`,
    );
  }
  const rowCount = params.length / columnCount;
  const now = new Date();

  const newColumns = [...columns, ...missing].join(", ");
  const tuple = `(${Array(columnCount + missing.length)
    .fill("?")
    .join(", ")})`;
  const newValuesClause = Array(rowCount).fill(tuple).join(", ");

  const newParams: unknown[] = [];
  for (let row = 0; row < rowCount; row++) {
    newParams.push(...params.slice(row * columnCount, (row + 1) * columnCount));
    for (let i = 0; i < missing.length; i++) newParams.push(now);
  }

  return {
    sql: `${prefix}(${newColumns}) VALUES ${newValuesClause}${suffix}`,
    params: newParams,
  };
}

/** Translates one MySQL-dialect statement + its params into SQLite's dialect. */
export function translateStatement(
  sql: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  const withTimestampsInjected = injectMissingTimestamps(sql, params);
  const withUpsertRewritten = rewriteUpsert(withTimestampsInjected.sql);
  const { sql: withNowRewritten, params: paramsAfterNow } = rewriteNow(
    withUpsertRewritten,
    withTimestampsInjected.params,
  );
  return { sql: withNowRewritten, params: marshalParams(paramsAfterNow) };
}

function isSelectLike(sql: string): boolean {
  return /^\s*SELECT\b/i.test(sql);
}

/**
 * Builds a `callDataApi`-compatible function backed by `driver`. This is
 * what `dataApi.native.ts` exports as its `callDataApi` — Metro picks that
 * file automatically on native builds, so `server/db.ts` never has to know
 * which engine answered its query.
 */
export function createSqliteDataApi(
  driver: SqliteDriver,
): (
  apiId: string,
  options?: { body?: Record<string, unknown> },
) => Promise<unknown> {
  return async function callDataApi(apiId, options = {}) {
    if (apiId !== "Database/query") {
      throw new Error(
        `sqlite-engine: API "${apiId}" is not implemented by the local data layer`,
      );
    }

    const rawSql = options.body?.query as string | undefined;
    const rawParams = (options.body?.params as unknown[]) ?? [];
    if (!rawSql) {
      throw new Error("sqlite-engine: Database/query requires body.query");
    }

    const { sql, params } = translateStatement(rawSql, rawParams);

    if (isSelectLike(sql)) {
      const rows = await driver.selectAll(sql, params);
      return rows.map(unmarshalRow);
    }

    const result = await driver.run(sql, params);
    // `insertId` is unused by every caller now — server/db.ts mints its own
    // ULID before every INSERT (see the comment on `upsertUser`) rather than
    // reading back an autoincrement value. `null` (not `0`, MySQL's "no
    // autoincrement happened" sentinel) marks it as structurally absent.
    return { insertId: null, affectedRows: result.changes };
  };
}
