import type { Id } from "@/drizzle/schema";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  hashPin,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
  __resetSetPinThrottleForTests,
} from "../server/_core/pin-crypto";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import {
  getUserPinState,
  setUserPin,
  clearUserPin,
  resetPinAttempts,
  resetExpiredPinLockout,
  recordFailedPinAttempt,
} from "../server/db";
import { testId } from "./helpers/ids";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId: Id): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "password",
    passwordHash: null,
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
      { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);

    await expect(getUserPinState(testId(1))).resolves.toEqual({
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT pinHash, pinFailedAttempts, pinLockedUntil FROM users WHERE id = ?",
        params: [testId(1)],
      },
    });
  });

  it("parses a stored hash and lockout timestamp", async () => {
    callDataApi.mockResolvedValueOnce([
      {
        pinHash: "scrypt:v1:abc:def",
        pinFailedAttempts: 3,
        pinLockedUntil: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(getUserPinState(testId(1))).resolves.toEqual({
      pinHash: "scrypt:v1:abc:def",
      pinFailedAttempts: 3,
      pinLockedUntil: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("defaults to no PIN when the user row is missing", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(getUserPinState(testId(404))).resolves.toEqual({
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });
  });
});

describe("setUserPin / clearUserPin / resetPinAttempts", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("setUserPin stores the hash and resets attempt state, scoped by id", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await setUserPin(testId(5), "scrypt:v1:salt:hash");

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: ["scrypt:v1:salt:hash", 0, null, testId(5)],
      },
    });
  });

  it("clearUserPin nulls the hash and resets attempt state, scoped by id", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await clearUserPin(testId(5));

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [null, 0, null, testId(5)],
      },
    });
  });

  it("resetPinAttempts clears failedAttempts and lockedUntil without touching the hash", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await resetPinAttempts(testId(5));

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [0, null, testId(5)],
      },
    });
  });
});

describe("resetExpiredPinLockout (B2)", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("issues an atomic reset guarded by an already-expired lockout", async () => {
    callDataApi.mockResolvedValueOnce({ affectedRows: 1 });
    const now = new Date("2026-01-01T00:00:00Z");

    await resetExpiredPinLockout(testId(5), now);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ? AND pinLockedUntil IS NOT NULL AND pinLockedUntil <= ?",
        params: [0, null, testId(5), now],
      },
    });
  });
});

describe("recordFailedPinAttempt (B1 — atomic, guarded increment)", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("issues a single atomic UPDATE that increments and conditionally locks, guarded against an already-locked row", async () => {
    callDataApi.mockResolvedValueOnce({ affectedRows: 1 });
    const now = new Date("2026-01-01T00:00:00Z");
    const lockedUntilIfTripped = new Date(now.getTime() + PIN_LOCKOUT_MS);

    const result = await recordFailedPinAttempt(testId(5), {
      maxAttempts: MAX_PIN_ATTEMPTS,
      lockedUntilIfTripped,
      now,
    });

    expect(result).toEqual({ counted: true });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          // pinLockedUntil is assigned BEFORE pinFailedAttempts deliberately —
          // MySQL evaluates SET assignments left to right, so this order is
          // what makes the IF() read the pre-increment count (round-2 R1).
          "UPDATE users SET pinLockedUntil = IF(pinFailedAttempts + 1 >= ?, ?, NULL), pinFailedAttempts = pinFailedAttempts + 1 WHERE id = ? AND (pinLockedUntil IS NULL OR pinLockedUntil <= ?)",
        params: [MAX_PIN_ATTEMPTS, lockedUntilIfTripped, testId(5), now],
      },
    });
  });

  it("reports counted: false when the WHERE guard excludes an already-locked row (concurrent race)", async () => {
    callDataApi.mockResolvedValueOnce({ affectedRows: 0 });
    const now = new Date("2026-01-01T00:00:00Z");

    const result = await recordFailedPinAttempt(testId(5), {
      maxAttempts: MAX_PIN_ATTEMPTS,
      lockedUntilIfTripped: new Date(now.getTime() + PIN_LOCKOUT_MS),
      now,
    });

    expect(result).toEqual({ counted: false });
  });
});

describe("security router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    // setPin's throttle (N3) is process-lifetime, in-memory state — reset it
    // so unrelated tests calling setPin for the same userId don't interfere.
    __resetSetPinThrottleForTests();
  });

  it("getPinStatus reports false when no hash is stored", async () => {
    callDataApi.mockResolvedValueOnce([
      { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(caller.security.getPinStatus()).resolves.toEqual({
      pinSet: false,
    });
  });

  it("getPinStatus reports true when a hash is stored", async () => {
    callDataApi.mockResolvedValueOnce([
      { pinHash: "scrypt:v1:a:b", pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(caller.security.getPinStatus()).resolves.toEqual({
      pinSet: true,
    });
  });

  it("setPin hashes the PIN server-side and never stores the plaintext", async () => {
    callDataApi
      .mockResolvedValueOnce([
        { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    await expect(caller.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });

    const call = callDataApi.mock.calls[1][1] as {
      body: { query: string; params: unknown[] };
    };
    expect(call.body.query).toContain("UPDATE users SET pinHash");
    const storedHash = call.body.params[0] as string;
    expect(storedHash).not.toBe("1234");
    expect(storedHash).not.toContain("1234");
    expect(storedHash.startsWith("scrypt:v1:")).toBe(true);
  });

  it("setPin requires proof of the current PIN when one is already set (N4)", async () => {
    const existingHash = await hashPin("1234");
    callDataApi.mockResolvedValueOnce([
      { pinHash: existingHash, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    // CONFLICT, not BAD_REQUEST — the client discriminates on this code to
    // explain that another device already set the account PIN, and Zod input
    // failures on this same procedure use BAD_REQUEST (round-3 review T3).
    // The "rejects a non-4-digit PIN" case below pins that other half down.
    await expect(caller.security.setPin({ pin: "5678" })).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
    // Only the read for the currentPin check happened — no overwrite without proof.
    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("setPin rejects a wrong currentPin instead of overwriting", async () => {
    const existingHash = await hashPin("1234");
    callDataApi.mockResolvedValueOnce([
      { pinHash: existingHash, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    await expect(
      caller.security.setPin({ pin: "5678", currentPin: "0000" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("setPin overwrites when the correct currentPin is supplied", async () => {
    const existingHash = await hashPin("1234");
    callDataApi
      .mockResolvedValueOnce([
        { pinHash: existingHash, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    await expect(
      caller.security.setPin({ pin: "5678", currentPin: "1234" }),
    ).resolves.toEqual({ pinSet: true });
  });

  it("setPin allows first-time sync without currentPin when no hash exists yet", async () => {
    callDataApi
      .mockResolvedValueOnce([
        { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    await expect(caller.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });
  });

  it("rejects a non-4-digit PIN at the input boundary", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(7)));
    await expect(caller.security.setPin({ pin: "12" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("throttles rapid consecutive setPin calls for the same user (N3)", async () => {
    callDataApi
      .mockResolvedValueOnce([
        { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(testId(9)));

    await expect(caller.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });

    await expect(
      caller.security.setPin({ pin: "5678", currentPin: "1234" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    // The throttled call must never reach the DB layer at all.
    expect(callDataApi).toHaveBeenCalledTimes(2);
  });

  it("does not throttle setPin across different users", async () => {
    callDataApi.mockResolvedValue([
      { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
    ]);
    const callerA = appRouter.createCaller(createUserContext(testId(101)));
    const callerB = appRouter.createCaller(createUserContext(testId(102)));

    await expect(callerA.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });
    await expect(callerB.security.setPin({ pin: "1234" })).resolves.toEqual({
      pinSet: true,
    });
  });

  it("clearPin nulls the stored hash without requiring proof of the current PIN", async () => {
    // Deliberately no proof required: this is what the Forgot-PIN/sign-out
    // path (N1) needs precisely when the caller does not know the PIN. The
    // authenticated session is the trust boundary here, same as any other
    // sign-out action — see the router's assertCurrentPinProof comment.
    callDataApi.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createUserContext(testId(7)));

    await expect(caller.security.clearPin()).resolves.toEqual({
      pinSet: false,
    });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [null, 0, null, testId(7)],
      },
    });
  });

  it("verifyPin succeeds for the correct PIN and resets attempt state", async () => {
    const stored = await hashPin("1234");
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 }) // resetExpiredPinLockout (no-op)
      .mockResolvedValueOnce([
        { pinHash: stored, pinFailedAttempts: 2, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce(undefined); // resetPinAttempts
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    await expect(caller.security.verifyPin({ pin: "1234" })).resolves.toEqual({
      valid: true,
    });

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
        params: [0, null, testId(3)],
      },
    });
  });

  it("verifyPin fails for the wrong PIN and atomically increments attempts", async () => {
    const stored = await hashPin("1234");
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 }) // resetExpiredPinLockout (no-op)
      .mockResolvedValueOnce([
        { pinHash: stored, pinFailedAttempts: 0, pinLockedUntil: null },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 }) // recordFailedPinAttempt
      .mockResolvedValueOnce([
        { pinHash: stored, pinFailedAttempts: 1, pinLockedUntil: null },
      ]); // final read for the response
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    const result = await caller.security.verifyPin({ pin: "0000" });
    expect(result.valid).toBe(false);
    expect(result.attemptsRemaining).toBe(4);
    expect(result.lockedUntil).toBeNull();
  });

  it("verifyPin locks out after MAX_PIN_ATTEMPTS consecutive failures", async () => {
    const stored = await hashPin("1234");
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 })
      .mockResolvedValueOnce([
        {
          pinHash: stored,
          pinFailedAttempts: MAX_PIN_ATTEMPTS - 1,
          pinLockedUntil: null,
        },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([
        {
          pinHash: stored,
          pinFailedAttempts: MAX_PIN_ATTEMPTS,
          pinLockedUntil: lockedUntil.toISOString(),
        },
      ]);
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    const result = await caller.security.verifyPin({ pin: "0000" });
    expect(result.valid).toBe(false);
    expect(result.attemptsRemaining).toBe(0);
    expect(result.lockedUntil).not.toBeNull();
  });

  it("verifyPin reports the lock as structured data while locked out, without attempting the hash compare (R5)", async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 }) // resetExpiredPinLockout (lock still in the future — no-op)
      .mockResolvedValueOnce([
        {
          pinHash: await hashPin("1234"),
          pinFailedAttempts: MAX_PIN_ATTEMPTS,
          pinLockedUntil: lockedUntil.toISOString(),
        },
      ]);
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    const result = await caller.security.verifyPin({ pin: "1234" });
    expect(result).toEqual({
      valid: false,
      attemptsRemaining: 0,
      lockedUntil: lockedUntil.toISOString(),
    });
    // reset-expiry + read only — no increment write for an already-locked account.
    expect(callDataApi).toHaveBeenCalledTimes(2);
  });

  it("verifyPin reports the lock as structured data when a concurrent request wins the lock race (B1/R5)", async () => {
    const stored = await hashPin("1234");
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 }) // resetExpiredPinLockout (no-op)
      .mockResolvedValueOnce([
        {
          pinHash: stored,
          pinFailedAttempts: MAX_PIN_ATTEMPTS - 1,
          pinLockedUntil: null,
        },
      ]) // read: not yet locked from this request's point of view
      .mockResolvedValueOnce({ affectedRows: 0 }) // a sibling request locked the row first — WHERE guard excludes us
      .mockResolvedValueOnce([
        {
          pinHash: stored,
          pinFailedAttempts: MAX_PIN_ATTEMPTS,
          pinLockedUntil: lockedUntil.toISOString(),
        },
      ]); // re-fetch to report the lock
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    const result = await caller.security.verifyPin({ pin: "0000" });
    expect(result).toEqual({
      valid: false,
      attemptsRemaining: 0,
      lockedUntil: lockedUntil.toISOString(),
    });
  });

  it("verifyPin rejects with NOT_FOUND when no PIN is synced yet", async () => {
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 0 })
      .mockResolvedValueOnce([
        { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null },
      ]);
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    await expect(
      caller.security.verifyPin({ pin: "1234" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("verifyPin normalizes an expired lockout before evaluating (B2 — no permanent re-lock)", async () => {
    const stored = await hashPin("1234");
    callDataApi
      .mockResolvedValueOnce({ affectedRows: 1 }) // resetExpiredPinLockout actually reset a stale lock
      .mockResolvedValueOnce([
        { pinHash: stored, pinFailedAttempts: 0, pinLockedUntil: null },
      ]) // read reflects the reset state
      .mockResolvedValueOnce(undefined); // resetPinAttempts on success
    const caller = appRouter.createCaller(createUserContext(testId(3)));

    // A correct PIN right after an expired lockout must succeed, not stay locked.
    await expect(caller.security.verifyPin({ pin: "1234" })).resolves.toEqual({
      valid: true,
    });
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
