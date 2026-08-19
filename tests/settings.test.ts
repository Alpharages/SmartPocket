import type { Id } from "@/drizzle/schema";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import { getUserSettings, updateAiEnabled } from "../server/db";
import { testId } from "./helpers/ids";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId: Id): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    aiEnabled: false,
    remindersEnabled: false,
    pinHash: null,
  cardKey: null,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("getUserSettings", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("returns aiEnabled false when MySQL stores 0", async () => {
    callDataApi.mockResolvedValueOnce([{ aiEnabled: 0, remindersEnabled: 0 }]);

    await expect(getUserSettings(testId(42))).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "SELECT aiEnabled, remindersEnabled FROM users WHERE id = ?",
        params: [testId(42)],
      },
    });
  });

  it("coerces MySQL 1 to boolean true", async () => {
    callDataApi.mockResolvedValueOnce([{ aiEnabled: 1, remindersEnabled: 1 }]);

    await expect(getUserSettings(testId(7))).resolves.toEqual({
      aiEnabled: true,
      remindersEnabled: true,
    });
  });

  it('treats string "0" as false (not Boolean coercion)', async () => {
    callDataApi.mockResolvedValueOnce([
      { aiEnabled: "0", remindersEnabled: "0" },
    ]);

    await expect(getUserSettings(testId(8))).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });
  });

  it('treats string "1" as false for default-off safety', async () => {
    callDataApi.mockResolvedValueOnce([
      { aiEnabled: "1", remindersEnabled: "1" },
    ]);

    await expect(getUserSettings(testId(8))).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });
  });

  it("defaults to false when no row is returned", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(getUserSettings(testId(99))).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });
  });
});

describe("updateAiEnabled", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("updates aiEnabled with parameterized SQL", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await updateAiEnabled(testId(5), true);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "UPDATE users SET aiEnabled = ? WHERE id = ?",
        params: [true, testId(5)],
      },
    });
  });
});

describe("settings router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("get returns aiEnabled default false for a user", async () => {
    callDataApi.mockResolvedValueOnce([{ aiEnabled: 0, remindersEnabled: 0 }]);
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(caller.settings.get()).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });
  });

  it("setAiEnabled round-trips true then false scoped by user id", async () => {
    callDataApi
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ aiEnabled: 1, remindersEnabled: 0 }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ aiEnabled: 0, remindersEnabled: 0 }]);

    const caller = appRouter.createCaller(createUserContext(testId(10)));

    await expect(
      caller.settings.setAiEnabled({ enabled: true }),
    ).resolves.toEqual({
      aiEnabled: true,
    });
    await expect(caller.settings.get()).resolves.toEqual({
      aiEnabled: true,
      remindersEnabled: false,
    });

    await expect(
      caller.settings.setAiEnabled({ enabled: false }),
    ).resolves.toEqual({
      aiEnabled: false,
    });
    await expect(caller.settings.get()).resolves.toEqual({
      aiEnabled: false,
      remindersEnabled: false,
    });

    const updateCalls = callDataApi.mock.calls.filter((call) =>
      (call[1] as { body: { query: string } }).body.query.includes(
        "UPDATE users SET aiEnabled",
      ),
    );
    expect(updateCalls).toHaveLength(2);
    expect(
      (updateCalls[0][1] as { body: { params: unknown[] } }).body.params,
    ).toEqual([true, testId(10)]);
    expect(
      (updateCalls[1][1] as { body: { params: unknown[] } }).body.params,
    ).toEqual([false, testId(10)]);
  });

  it("scopes settings.get to ctx.user.id", async () => {
    callDataApi.mockResolvedValueOnce([{ aiEnabled: 1, remindersEnabled: 1 }]);
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    await caller.settings.get();

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "SELECT aiEnabled, remindersEnabled FROM users WHERE id = ?",
        params: [testId(3)],
      },
    });
  });

  it("rejects unauthenticated settings.get", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.settings.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects unauthenticated settings.setAiEnabled", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(
      caller.settings.setAiEnabled({ enabled: true }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("AI no-behavior guard (AC3)", () => {
  it("settings code paths do not import or call the LLM gateway", async () => {
    const fs = await import("node:fs");
    const paths = [
      "server/routers.ts",
      "server/db.ts",
      "lib/settings-provider.tsx",
      "app/settings.tsx",
    ];

    for (const file of paths) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/invokeLLM|_core\/llm/);
    }
  });
});
