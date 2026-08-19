import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";

const syncWorker = vi.hoisted(() => ({ runSync: vi.fn() }));
vi.mock("@/lib/sync/sync-worker", () => syncWorker);

const remoteClient = vi.hoisted(() => ({
  createRemoteSyncClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/sync/remote-client", () => remoteClient);

// auto-sync reaches sync-state only for `isSyncSupported`, but that module is
// expo-secure-store backed. Stubbing the native module (rather than the
// module itself) keeps the real Platform.OS check under test.
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

const userId = testId(1);

/** Resolves only once `release()` is called, so a cycle can be held open. */
function pendingCycle() {
  let release!: (value: unknown) => void;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * `vi.resetModules()` hands every dynamic import a fresh module registry, so
 * the react-native instance this file imported at the top is *not* the one
 * the module under test sees. Platform has to be reached for after the reset,
 * through the same registry.
 */
async function setPlatform(os: string): Promise<void> {
  const rn = await import("react-native");
  (rn.Platform as { OS: string }).OS = os;
}

describe("runGuardedSync", () => {
  beforeEach(async () => {
    vi.resetModules();
    syncWorker.runSync.mockReset().mockResolvedValue({
      status: "synced",
      pushed: 0,
      pulled: 0,
    });
    remoteClient.createRemoteSyncClient.mockClear();
    await setPlatform("android");
    const { __resetAutoSyncStateForTests } = await import(
      "@/lib/sync/auto-sync"
    );
    __resetAutoSyncStateForTests();
  });

  it("runs a cycle and returns its outcome", async () => {
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    await expect(runGuardedSync(userId)).resolves.toEqual({
      status: "synced",
      pushed: 0,
      pulled: 0,
    });
    expect(syncWorker.runSync).toHaveBeenCalledOnce();
  });

  // Two overlapping cycles would push the same dirty rows twice and race on
  // the pull cursor — foregrounding the app during a manual "Sync now" is an
  // entirely ordinary way to cause that.
  it("joins the cycle already in flight instead of starting a second", async () => {
    const cycle = pendingCycle();
    syncWorker.runSync.mockReturnValue(cycle.promise);
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    const first = runGuardedSync(userId);
    const second = runGuardedSync(userId);

    cycle.release({ status: "synced", pushed: 1, pulled: 2 });
    const [a, b] = await Promise.all([first, second]);

    expect(syncWorker.runSync).toHaveBeenCalledOnce();
    expect(a).toEqual(b);
  });

  it("skips an automatic run inside the throttle window, returning null", async () => {
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    await runGuardedSync(userId);
    expect(syncWorker.runSync).toHaveBeenCalledOnce();

    await expect(
      runGuardedSync(userId, { minIntervalMs: 60_000 }),
    ).resolves.toBeNull();
    expect(syncWorker.runSync).toHaveBeenCalledOnce();
  });

  // A button press must always do something visible, however recently the
  // background trigger happened to fire.
  it("never throttles an explicit run", async () => {
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    await runGuardedSync(userId, { minIntervalMs: 60_000 });
    await runGuardedSync(userId);

    expect(syncWorker.runSync).toHaveBeenCalledTimes(2);
  });

  // Being offline is the normal state for a local-first app; a device that
  // cannot reach the server should back off like any other, not retry on
  // every single foreground.
  it("starts the throttle window after a failed cycle too", async () => {
    syncWorker.runSync.mockRejectedValue(new Error("offline"));
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    await expect(runGuardedSync(userId)).rejects.toThrow("offline");

    await expect(
      runGuardedSync(userId, { minIntervalMs: 60_000 }),
    ).resolves.toBeNull();
    expect(syncWorker.runSync).toHaveBeenCalledOnce();
  });

  it("does nothing on web, which has no local database to sync from", async () => {
    await setPlatform("web");
    const { runGuardedSync } = await import("@/lib/sync/auto-sync");

    await expect(runGuardedSync(userId)).resolves.toBeNull();
    expect(syncWorker.runSync).not.toHaveBeenCalled();
  });
});
