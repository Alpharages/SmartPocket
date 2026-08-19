import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useExpense } from "@/lib/expense-context";
import { runGuardedSync } from "@/lib/sync/auto-sync";

/**
 * Runs a sync cycle on launch and whenever the app returns to the foreground.
 *
 * Without this, `runSync` was only ever reachable from the Settings screen —
 * so "two devices editing the same account and staying in step"
 * (local-first-sync-plan.md's stated goal) meant the user manually opening
 * Settings and tapping "Sync now" on each phone. Nothing about the design
 * needed that; the trigger was simply missing.
 *
 * Rendered as a null sibling of the navigator, the same shape as AuthGate, so
 * it never gates a paint. Everything it needs to decide is already checked
 * downstream: `runSync` returns `{status:"disabled"}` when the user has not
 * turned sync on, and `runGuardedSync` no-ops on web, coalesces with a
 * "Sync now" already in flight, and throttles repeat foregrounds.
 */

// Long enough that flicking between apps costs nothing, short enough that
// coming back to the phone after a while picks up another device's edits.
const FOREGROUND_MIN_INTERVAL_MS = 60_000;

export function SyncGate() {
  const { user } = useAuth();
  const { refreshAll } = useExpense();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    // Failures are swallowed on purpose. Being offline is the normal state
    // for a local-first app, not an error worth interrupting anyone over —
    // the rows stay dirty and the next cycle pushes them. A sync the *user*
    // asked for still surfaces its failure, in the Settings screen.
    const attempt = (minIntervalMs: number) => {
      void runGuardedSync(userId, { minIntervalMs })
        .then((outcome) => {
          // A pull writes straight into SQLite, underneath the app's own
          // state, so nothing upstream knows the data changed and every
          // screen keeps rendering what it read at startup.
          //
          // `refreshAll` rather than `queryClient.invalidateQueries()`:
          // expense-context does not render from the query cache, it mirrors
          // each query into `useState` and seeds those mirrors from a
          // mount-only effect. Invalidating refetches the queries but leaves
          // the mirrors untouched, so the screens stayed stale until the app
          // was restarted — which is exactly what a device pulling another
          // device's edit looked like before this.
          //
          // Only on a pull that actually brought something back: refetching
          // eleven queries on every idle cycle is not free.
          if (outcome?.status === "synced" && outcome.pulled > 0) {
            void refreshAll();
          }
        })
        .catch(() => {});
    };

    attempt(0);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") attempt(FOREGROUND_MIN_INTERVAL_MS);
    });

    return () => subscription.remove();
  }, [userId, refreshAll]);

  return null;
}
