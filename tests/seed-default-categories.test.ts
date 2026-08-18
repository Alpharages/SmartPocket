import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CATEGORIES } from "@/server/_core/default-categories";
import { testId } from "./helpers/ids";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

function countQueryBody(callIndex: number) {
  return (
    callDataApi.mock.calls[callIndex][1] as {
      body: { query: string; params: unknown[] };
    }
  ).body;
}

function insertQueryBodies() {
  return callDataApi.mock.calls
    .slice(1)
    .map(
      (call) =>
        (call[1] as { body: { query: string; params: unknown[] } }).body,
    )
    .filter((body) => body.query.includes("INSERT INTO categories"));
}

describe("seedDefaultCategories", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    vi.resetModules();
  });

  it("seeds all default categories when the user has none", async () => {
    callDataApi
      .mockResolvedValueOnce([{ categoryCount: 0 }])
      .mockResolvedValue({ insertId: 1 });

    const { seedDefaultCategories } = await import("@/server/db");
    await seedDefaultCategories(testId(42));

    expect(countQueryBody(0).query).toMatch(
      /SELECT COUNT\(\*\) as categoryCount FROM categories WHERE userId = \?/,
    );
    expect(countQueryBody(0).params).toEqual([testId(42)]);

    const inserts = insertQueryBodies();
    expect(inserts).toHaveLength(DEFAULT_CATEGORIES.length);

    inserts.forEach((body, index) => {
      const def = DEFAULT_CATEGORIES[index];
      expect(body.params).toEqual([
        expect.any(String),
        testId(42),
        def.name,
        def.type,
        def.color,
        def.icon,
        true,
      ]);
    });

    const types = inserts.map((body) => body.params[3]);
    expect(types).toContain("income");
    expect(types).toContain("expense");
  });

  it("no-ops when the user already has categories", async () => {
    callDataApi.mockResolvedValueOnce([{ categoryCount: 3 }]);

    const { seedDefaultCategories } = await import("@/server/db");
    await seedDefaultCategories(testId(7));

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(insertQueryBodies()).toHaveLength(0);
  });

  it("inserts defaults at most once when invoked twice", async () => {
    callDataApi
      .mockResolvedValueOnce([{ categoryCount: 0 }])
      .mockResolvedValue({ insertId: 1 });

    const { seedDefaultCategories } = await import("@/server/db");
    await seedDefaultCategories(testId(99));
    const callsAfterFirst = callDataApi.mock.calls.length;

    callDataApi.mockResolvedValueOnce([
      { categoryCount: DEFAULT_CATEGORIES.length },
    ]);
    await seedDefaultCategories(testId(99));

    expect(insertQueryBodies()).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(callDataApi.mock.calls.length).toBe(callsAfterFirst + 1);
  });
});

describe("ensureUserSeeded", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    vi.resetModules();
  });

  it("logs and does not throw when seeding fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    callDataApi.mockRejectedValueOnce(new Error("db down"));

    const { ensureUserSeeded } = await import("@/server/_core/user-seeding");
    await expect(ensureUserSeeded(testId(1))).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "[seed] failed to seed default user data",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
