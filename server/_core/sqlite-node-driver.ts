import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { SqliteDriver, SqliteWriteResult, Row } from "./sqlite-engine";

/**
 * Loaded via `process.getBuiltinModule` rather than a static
 * `import ... from "node:sqlite"`: Vite (which Vitest runs every test file
 * through, even under `environment: "node"`) doesn't yet recognize this
 * fairly new built-in in its externalization list, and a static import gets
 * rewritten into a doomed attempt to resolve an npm package literally named
 * "sqlite". Going through `process.getBuiltinModule` is invisible to Vite's
 * static analysis, so it reaches Node's real built-in untouched. This file is
 * Node-only regardless (see the module doc comment) — Metro never bundles it
 * into the native app — so there is no browser/RN environment where
 * `process.getBuiltinModule` needs a fallback.
 */
const { DatabaseSync } = process.getBuiltinModule(
  "node:sqlite",
) as typeof import("node:sqlite");

/**
 * `SqliteDriver` over Node's built-in `node:sqlite`. Not part of the shipped
 * app — Metro never bundles this into the native build, since nothing under
 * `dataApi.native.ts` imports it. Its job is to let `sqlite-engine.ts` be
 * tested against a genuine SQLite engine instead of a hand-rolled fake, and
 * to give any future Node-hosted tooling (a CLI import/export script, a
 * local dev harness) the same engine the app itself runs on.
 *
 * `node:sqlite` is synchronous (`DatabaseSync`); every method here still
 * returns a `Promise` to satisfy `SqliteDriver`, so a test written against
 * this driver exercises the exact same async call sites `dataApi.native.ts`
 * does against the genuinely-async `expo-sqlite`.
 */
export function createNodeSqliteDriver(
  db: DatabaseSyncType = new DatabaseSync(":memory:"),
): SqliteDriver {
  return {
    async execScript(sql: string): Promise<void> {
      db.exec(sql);
    },

    async run(sql: string, params: unknown[]): Promise<SqliteWriteResult> {
      const result = db.prepare(sql).run(...(params as never[]));
      return { changes: Number(result.changes) };
    },

    async selectAll(sql: string, params: unknown[]): Promise<Row[]> {
      return db.prepare(sql).all(...(params as never[])) as Row[];
    },

    async getUserVersion(): Promise<number> {
      const row = db.prepare("PRAGMA user_version").get() as
        | { user_version: number }
        | undefined;
      return row?.user_version ?? 0;
    },

    async setUserVersion(version: number): Promise<void> {
      // PRAGMA does not accept a bound parameter here — the value is a
      // migration array index this module controls, never user input.
      db.exec(`PRAGMA user_version = ${version}`);
    },
  };
}
