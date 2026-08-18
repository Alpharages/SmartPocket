import * as SQLite from "expo-sqlite";
import {
  createSqliteDataApi,
  runMigrations,
  type Row,
  type SqliteDriver,
} from "./sqlite-engine";
import type { DataApiCallOptions } from "./dataApi";

/**
 * The on-device replacement for `dataApi.ts`. Metro resolves `.native.ts`
 * over the bare `.ts` file automatically for iOS/Android builds — nothing
 * elsewhere in the app imports this file by name, so no `if (Platform.OS)`
 * branching exists anywhere on the data path. `server/db.ts` and all 64 tRPC
 * procedures built on it run completely unmodified against whichever file
 * Metro picked; this file's only job is to make `callDataApi` answer the
 * same `{apiId, options} -> result` shape `dataApi.ts` does, backed by a
 * local SQLite database instead of a MySQL connection over HTTP.
 *
 * All of the actual translation/marshaling logic lives in
 * `sqlite-engine.ts`, which has no expo-sqlite import and is exercised
 * directly in `tests/sqlite-engine.test.ts` against `node:sqlite`. This file
 * is intentionally the thinnest possible adapter — there is nothing here to
 * unit test that isn't better tested one layer down, since a real RN runtime
 * isn't available in this repo's test environment.
 */

const DATABASE_NAME = "smartpocket.db";

function createExpoSqliteDriver(db: SQLite.SQLiteDatabase): SqliteDriver {
  return {
    async execScript(sql: string): Promise<void> {
      await db.execAsync(sql);
    },

    async run(sql: string, params: unknown[]) {
      const result = await db.runAsync(sql, params as SQLite.SQLiteBindParams);
      return { changes: result.changes };
    },

    async selectAll(sql: string, params: unknown[]): Promise<Row[]> {
      return db.getAllAsync<Row>(sql, params as SQLite.SQLiteBindParams);
    },

    async getUserVersion(): Promise<number> {
      const row = await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      return row?.user_version ?? 0;
    },

    async setUserVersion(version: number): Promise<void> {
      // PRAGMA does not accept a bound parameter — `version` is always a
      // migration array index from this module, never user input.
      await db.execAsync(`PRAGMA user_version = ${version}`);
    },
  };
}

/**
 * Opened once per process and reused — `expo-sqlite` documents opening a
 * database as comparatively expensive, and every call site already goes
 * through this single module. Memoizing the *promise* (not just the result)
 * means two calls to `callDataApi` racing on the very first query both await
 * the same open-and-migrate sequence instead of opening the database twice.
 */
let readyApi: Promise<
  (apiId: string, options?: DataApiCallOptions) => Promise<unknown>
> | null = null;

async function getReadyApi() {
  if (!readyApi) {
    readyApi = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      // WAL lets a read proceed while a write is in flight — the dashboard's
      // background refresh and a form's in-progress save should not block
      // each other. Off by default; every other engine (MySQL via mysql2)
      // already allows this, so this is matching that, not exceeding it.
      await db.execAsync("PRAGMA journal_mode = WAL");
      const driver = createExpoSqliteDriver(db);
      await runMigrations(driver);
      return createSqliteDataApi(driver);
    })();
  }
  return readyApi;
}

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {},
): Promise<unknown> {
  const api = await getReadyApi();
  return api(apiId, options);
}
