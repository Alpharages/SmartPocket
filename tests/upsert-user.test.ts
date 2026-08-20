import { beforeEach, describe, expect, it, vi } from "vitest";
import { isUlid } from "@shared/ulid";

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

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
    const body = dbQuery.mock.calls[0][1] as {
      body: { query: string; params: unknown[] };
    };
    expect(body.body.query).toMatch(/INSERT INTO users \(id, openId/);
    const insertedId = body.body.params[0] as string;
    expect(isUlid(insertedId)).toBe(true);
  });

  it("never overwrites the existing id on a returning user (ON DUPLICATE KEY UPDATE excludes id)", async () => {
    const { upsertUser } = await import("@/server/db");

    await upsertUser({ openId: "user-123", name: "Returning User" });

    const body = dbQuery.mock.calls[0][1] as {
      body: { query: string };
    };
    expect(body.body.query).not.toMatch(/id = VALUES\(id\)/);
    expect(body.body.query).toMatch(/name = VALUES\(name\)/);
  });

  it("mints a distinct id on every call", async () => {
    const { upsertUser } = await import("@/server/db");

    await upsertUser({ openId: "user-a" });
    await upsertUser({ openId: "user-b" });

    const firstId = (
      dbQuery.mock.calls[0][1] as { body: { params: unknown[] } }
    ).body.params[0];
    const secondId = (
      dbQuery.mock.calls[1][1] as { body: { params: unknown[] } }
    ).body.params[0];
    expect(firstId).not.toBe(secondId);
  });
});
