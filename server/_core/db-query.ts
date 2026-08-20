import { ENV } from "./env";
import { devQuery } from "./devDb";
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getPool() {
  if (!ENV.databaseUrl) {
    if (ENV.isProduction) {
      throw new Error("DATABASE_URL is required in production");
    }
    return null;
  }

  pool ??= mysql.createPool(ENV.databaseUrl);
  return pool;
}

/**
 * Runs one parameterized SQL statement.
 *
 * The signature used to be a request envelope inherited from the Manus Data
 * API this once called: a literal apiId, then the two values that actually
 * mattered wrapped in two layers of object. All 126 call sites passed the same
 * apiId (anything else threw). The envelope described a remote API that no
 * longer exists; what is left is a mysql2 pool.
 */
export async function dbQuery(
  sql: string,
  params: unknown[] = [],
): Promise<unknown> {
  const db = getPool();
  if (!db) {
    return devQuery(sql, params);
  }

  const [result] = await db.query(sql, params);
  if (Array.isArray(result)) {
    return result;
  }

  return result;
}
