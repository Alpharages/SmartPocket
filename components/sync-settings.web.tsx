/**
 * Sync is native-only (lib/sync/sync-state.ts's isSyncSupported) — web has
 * no local SQLite to sync from. This stub keeps the real implementation's
 * import chain (lib/sync/sync-worker.ts -> server/_core/sync-engine.ts and
 * server/_core/local-context.ts -> server/db.ts -> server/_core/dataApi.ts,
 * the MySQL/mysql2-backed default, since there's no dataApi.web.ts) out of
 * the web bundle entirely. mysql2 is Node-only and crashes at runtime in a
 * browser (no `process.env` Node polyfill) — it must never reach the web
 * client, only the server process and (via dataApi.native.ts) the native
 * client.
 */
export function SyncSettingsSection() {
  return null;
}
