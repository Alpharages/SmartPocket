import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { hashPin } from "../server/_core/pin-crypto";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import {
  getUserPinState,
  setUserPin,
  clearUserPin,
  recordPinAttemptResult,
} from "../server/db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId: number): TrpcContext {
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

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("getUserPinState", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("returns no PIN when the row has never had one set", async () => {
    callDataApi.mockResolvedValueOnce([
      { id: 1, pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);

    await expect(getUserPinState(1)).resolves.toEqual({
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: { query: "SELECT * FROM users WHERE id = ?", params: [1] },
    });
  });

  it("parses a stored hash and lockout timestamp", async () => {
    callDataApi.mockResolvedValueOnce([
      {
        id: 1,
        pinHash: "scrypt:v1:abc:def",
        pinFailedAttempts: 3,
        pinLockedUntil: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(getUserPinState(1)).resolves.toEqual({
      pinHash: "scrypt:v1:abc:def",
      pinFailedAttempts: 3,
      pinLockedUntil: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("defaults to no PIN when the user row is missing", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(getUserPinState(404)).resolves.toEqual({
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });
  });
});

describe("setUserPin / clearUserPin / recordPinAttemptResult", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("setUserPin stores the hash and resets attempt state, scoped by id", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await setUserPin(5, "scrypt:v1:salt:hash");

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: ["scrypt:v1:salt:hash", 0, null, 5],
      },
    });
  });

  it("clearUserPin nulls the hash and resets attempt state, scoped by id", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await clearUserPin(5);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [null, 0, null, 5],
      },
    });
  });

  it("recordPinAttemptResult writes failedAttempts and lockedUntil, scoped by id", async () => {
    callDataApi.mockResolvedValueOnce(undefined);
    const lockedUntil = new Date("2026-01-01T00:15:00.000Z");

    await recordPinAttemptResult(5, { failedAttempts: 5, lockedUntil });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [5, lockedUntil, 5],
      },
    });
  });
});

describe("security router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("getPinStatus reports false when no hash is stored", async () => {
    callDataApi.mockResolvedValueOnce([
      { id: 1, pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(caller.security.getPinStatus()).resolves.toEqual({
      pinSet: false,
    });
  });

  it("getPinStatus reports true when a hash is stored", async () => {
    callDataApi.mockResolvedValueOnce([
      {
        id: 1,
        pinHash: "scrypt:v1:a:b",
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    ]);
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(caller.security.getPinStatus()).resolves.toEqual({
      pinSet: true,
    });
  });

  it("setPin hashes the PIN server-side and never stores the plaintext", async () => {
    callDataApi.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(7));

    await expect(caller.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });

    const call = callDataApi.mock.calls[0][1] as {
      body: { query: string; params: unknown[] };
    };
    expect(call.body.query).toContain("UPDATE users SET pinHash");
    const storedHash = call.body.params[0] as string;
    expect(storedHash).not.toBe("1234");
    expect(storedHash).not.toContain("1234");
    expect(storedHash.startsWith("scrypt:v1:")).toBe(true);
  });

  it("rejects a non-4-digit PIN at the input boundary", async () => {
    const caller = appRouter.createCaller(createUserContext(7));
    await expect(caller.security.setPin({ pin: "12" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("clearPin nulls the stored hash", async () => {
    callDataApi.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(7));

    await expect(caller.security.clearPin()).resolves.toEqual({
      pinSet: false,
    });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [null, 0, null, 7],
      },
    });
  });

  it("verifyPin succeeds for the correct PIN and resets attempt state", async () => {
    const stored = hashPin("1234");
    callDataApi
      .mockResolvedValueOnce([
        { id: 3, pinHash: stored, pinFailedAttempts: 2, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(3));

    await expect(caller.security.verifyPin({ pin: "1234" })).resolves.toEqual({
      valid: true,
    });

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [0, null, 3],
      },
    });
  });

  it("verifyPin fails for the wrong PIN and increments attempts", async () => {
    const stored = hashPin("1234");
    callDataApi
      .mockResolvedValueOnce([
        { id: 3, pinHash: stored, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(3));

    const result = await caller.security.verifyPin({ pin: "0000" });
    expect(result.valid).toBe(false);
    expect(result.attemptsRemaining).toBe(4);
    expect(result.lockedUntil).toBeNull();
  });

  it("verifyPin locks out after MAX_PIN_ATTEMPTS consecutive failures", async () => {
    const stored = hashPin("1234");
    callDataApi
      .mockResolvedValueOnce([
        { id: 3, pinHash: stored, pinFailedAttempts: 4, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(3));

    const result = await caller.security.verifyPin({ pin: "0000" });
    expect(result.valid).toBe(false);
    expect(result.attemptsRemaining).toBe(0);
    expect(result.lockedUntil).not.toBeNull();
  });

  it("verifyPin rejects with TOO_MANY_REQUESTS while locked out, without a fresh hash attempt", async () => {
    callDataApi.mockResolvedValueOnce([
      {
        id: 3,
        pinHash: hashPin("1234"),
        pinFailedAttempts: 5,
        pinLockedUntil: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    const caller = appRouter.createCaller(createUserContext(3));

    await expect(
      caller.security.verifyPin({ pin: "1234" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    // Only the read happened — no attempt-state write for an already-locked account.
    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("verifyPin rejects with NOT_FOUND when no PIN is synced yet", async () => {
    callDataApi.mockResolvedValueOnce([
      { id: 3, pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(3));

    await expect(
      caller.security.verifyPin({ pin: "1234" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects unauthenticated calls to every security procedure", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());

    await expect(caller.security.getPinStatus()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.security.setPin({ pin: "1234" })).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
    await expect(caller.security.clearPin()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.security.verifyPin({ pin: "1234" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
