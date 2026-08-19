import type { Id } from "@/drizzle/schema";
import { createRemoteSyncClient } from "./remote-client";
import { isSyncSupported } from "./sync-state";
import { runSync, type SyncOutcome } from "./sync-worker";

/**
 * The single entry point for *running* a sync, shared by the Settings screen's
 * "Sync now" button and the automatic trigger (components/sync-gate.tsx).
 *
 * Two devices only stay in step if syncing happens without being asked for,
 * which is the whole point of local-first-sync-plan.md's multi-device goal —
 * but a push/pull cycle is also the one thing in this app that costs the user
 * bandwidth, so it is deliberately event-driven (launch, and returning to the
 * foreground) rather than polled on a timer.
 *
 * Everything here is about not running two cycles at once. `runSync` pushes
 * dirty rows and then advances a pull cursor; two overlapping cycles would
 * push the same rows twice and race on that cursor. Foregrounding the app
 * while a manual "Sync now" is still in flight is an entirely ordinary way to
 * make that happen, so concurrent callers share one cycle instead of starting
 * their own.
 */
let inFlight: Promise<SyncOutcome> | null = null;
let lastCompletedAt = 0;

/**
 * Runs a sync cycle, or joins the one already running.
 *
 * `minIntervalMs` throttles *automatic* callers — foregrounding the app
 * repeatedly should not mean a full push/pull each time — and is left at 0
 * for an explicit user action, which must always do something visible.
 * Returns `null` when the call was skipped rather than run.
 */
export function runGuardedSync(
  userId: Id,
  options: { minIntervalMs?: number } = {},
): Promise<SyncOutcome | null> {
  if (!isSyncSupported()) return Promise.resolve(null);
  if (inFlight) return inFlight;

  const minIntervalMs = options.minIntervalMs ?? 0;
  if (minIntervalMs > 0 && Date.now() - lastCompletedAt < minIntervalMs) {
    return Promise.resolve(null);
  }

  inFlight = (async () => {
    try {
      return await runSync(createRemoteSyncClient(), userId);
    } finally {
      // Stamped on failure too: a device that is simply offline should back
      // off like any other, not retry on every foreground.
      lastCompletedAt = Date.now();
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Test-only: clears the in-flight promise and the throttle between cases. */
export function __resetAutoSyncStateForTests(): void {
  inFlight = null;
  lastCompletedAt = 0;
}
