import { ENV } from "./env";
import { devQuery } from "./devDb";
import mysql from "mysql2/promise";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

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

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {},
): Promise<unknown> {
  if (apiId !== "Database/query") {
    throw new Error(
      `API "${apiId}" is not configured without Forge credentials`,
    );
  }

  const sql = options.body?.query as string | undefined;
  const params = (options.body?.params as unknown[]) ?? [];
  if (!sql)
    throw new Error("Database/query requires a SQL query in body.query");

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
