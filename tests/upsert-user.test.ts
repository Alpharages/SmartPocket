import { beforeEach, describe, expect, it, vi } from "vitest";
import { isUlid } from "@shared/ulid";

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

/** The old envelope shape, rebuilt from the (sql, params) argument pair so these
 * assertions keep reading as "what statement, with what values". */
function bodyOf(call: unknown[]) {
  return { query: String(call[0]), params: (call[1] ?? []) as unknown[] };
}

describe("upsertUser", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    dbQuery.mockResolvedValue(undefined);
  });

  it("mints and inserts a ULID id — a raw INSERT never picks up the schema's $defaultFn", async () => {
    const { upsertUser } = await import("@/server/db");

    await upsertUser({
      openId: "user-123",
      name: "New User",
      email: "new@example.com",
      loginMethod: "password",
      lastSignedIn: new Date("2026-06-01"),
    });

    expect(dbQuery).toHaveBeenCalledTimes(1);
    const body = bodyOf(dbQuery.mock.calls[0]);
    expect(body.query).toMatch(/INSERT INTO users \(id, openId/);
    const insertedId = body.params[0] as string;
    expect(isUlid(insertedId)).toBe(true);
  });

  it("never overwrites the existing id on a returning user (ON DUPLICATE KEY UPDATE excludes id)", async () => {
    const { upsertUser } = await import("@/server/db");

    await upsertUser({ openId: "user-123", name: "Returning User" });

    const body = bodyOf(dbQuery.mock.calls[0]);
    expect(body.query).not.toMatch(/id = VALUES\(id\)/);
    expect(body.query).toMatch(/name = VALUES\(name\)/);
  });

  it("mints a distinct id on every call", async () => {
    const { upsertUser } = await import("@/server/db");

    await upsertUser({ openId: "user-a" });
    await upsertUser({ openId: "user-b" });

    const firstId = bodyOf(dbQuery.mock.calls[0]).params[0];
    const secondId = bodyOf(dbQuery.mock.calls[1]).params[0];
    expect(firstId).not.toBe(secondId);
  });
});
