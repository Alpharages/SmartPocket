import type { Id } from "@/drizzle/schema";
import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";
import { testId } from "./helpers/ids";
import { isUlid } from "@shared/ulid";

describe("devDb accounts", () => {
  it("inserts and lists accounts", async () => {
    const insert = (await devQuery(
      `
        INSERT INTO accounts (userId, name, type, currency, isDefault)
        VALUES (?, ?, ?, ?, ?)
      `,
      [testId(1), "Cash", "cash", "USD", true],
    )) as { insertId: Id };

    expect(isUlid(insert.insertId)).toBe(true);

    const rows = (await devQuery(
      "SELECT * FROM accounts WHERE userId = ? AND deletedAt IS NULL ORDER BY name",
      [testId(1)],
    )) as Array<Record<string, unknown>>;

    expect(rows.some((row) => row.id === insert.insertId)).toBe(true);
    expect(rows.find((row) => row.id === insert.insertId)).toMatchObject({
      userId: testId(1),
      name: "Cash",
      type: "cash",
      currency: "USD",
      isDefault: true,
    });
  });
});
