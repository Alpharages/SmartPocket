/**
 * Sync is native-only (lib/sync/sync-state.ts's isSyncSupported) — web has no
 * local SQLite to sync from, so there is nothing for an automatic sync
 * trigger to do here.
 *
 * Same reason as components/sync-settings.web.tsx: the real implementation's
 * import chain (lib/sync/auto-sync.ts -> lib/sync/sync-worker.ts ->
 * server/_core/sync-engine.ts -> server/db.ts -> server/_core/dataApi.ts, the
 * MySQL/mysql2-backed default, since there's no dataApi.web.ts) must never
 * reach the web bundle. mysql2 is Node-only and crashes at runtime in a
 * browser. This file is mounted from app/_layout.tsx, so without the stub the
 * driver would be pulled into *every* web page rather than just Settings.
 */
export function SyncGate() {
  return null;
}
