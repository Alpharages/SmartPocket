import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTRPCClient as createVanillaTRPCClient } from "@trpc/client";
import { testId } from "./helpers/ids";

describe("resolveProcedure", () => {
  it("walks a dotted path into the nested caller object", async () => {
    const { resolveProcedure } = await import("@/lib/trpc.native");
    const caller = {
      accounts: {
        create: vi.fn().mockResolvedValue("created"),
      },
    };

    const procedure = resolveProcedure(caller, "accounts.create");
    await expect(procedure({ name: "Checking" })).resolves.toBe("created");
    expect(caller.accounts.create).toHaveBeenCalledWith({ name: "Checking" });
  });

  it("throws for a path with no matching procedure", async () => {
    const { resolveProcedure } = await import("@/lib/trpc.native");
    expect(() => resolveProcedure({}, "nope.list")).toThrow(
      /No procedure found at path "nope.list"/,
    );
  });
});

const localUser = vi.hoisted(() => ({
  getLocalOpenId: vi.fn(),
}));
vi.mock("@/lib/local-user", () => localUser);

describe("createInProcessLink against real SQLite end to end", () => {
  beforeEach(async () => {
    vi.resetModules();
    localUser.getLocalOpenId.mockReset().mockResolvedValue(testId(9));

    const { createNodeSqliteDriver } =
      await import("@/server/_core/sqlite-node-driver");
    const { runMigrations, createSqliteDataApi } =
      await import("@/server/_core/sqlite-engine");
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    vi.doMock("@/server/_core/db-query", () => ({
      dbQuery: createSqliteDataApi(driver),
    }));
  });

  it("dispatches a query straight through to the real router and real SQLite, no HTTP involved", async () => {
    const { createInProcessLink } = await import("@/lib/trpc.native");
    const { appRouter } = await import("@/server/routers");

    const client = createVanillaTRPCClient<typeof appRouter>({
      links: [createInProcessLink()],
    });

    // Nothing exists yet for this device — categories.list should still
    // succeed (an empty local user gets seeded default categories on first
    // resolution by server/_core/local-context.ts).
    const categories = await client.categories.list.query();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);

    const createdId = await client.categories.create.mutate({
      name: "Custom Category",
      type: "expense",
      color: "#123456",
      icon: "cart",
    });
    expect(typeof createdId).toBe("string");

    const afterCreate = await client.categories.list.query();
    expect(afterCreate.some((c) => c.name === "Custom Category")).toBe(true);
  });

  it("surfaces a TRPCClientError (not a raw throw) when a procedure rejects", async () => {
    const { createInProcessLink } = await import("@/lib/trpc.native");
    const { appRouter } = await import("@/server/routers");
    const { TRPCClientError } = await import("@trpc/client");

    const client = createVanillaTRPCClient<typeof appRouter>({
      links: [createInProcessLink()],
    });

    // categories.getById requires a valid ulid-shaped id; an obviously
    // malformed one fails the router's own zod validation, exercising the
    // same error path a real invalid call from the UI would hit.
    await expect(
      client.categories.getById.query({ id: "not-a-real-id" }),
    ).rejects.toBeInstanceOf(TRPCClientError);
  });
});
