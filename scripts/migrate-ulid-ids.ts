import "./load-env.js";
import {
  formatUlidMigrationSummary,
  migrateUlidIds,
} from "../server/migrate-ulid-ids";

async function main(): Promise<void> {
  try {
    const summary = await migrateUlidIds();
    console.log(formatUlidMigrationSummary(summary));
    // dataApi.ts holds an open mysql2 pool, which keeps the event loop alive
    // forever — without this the script prints its summary and then hangs.
    // A hung migration reads as a failed one: the operator kills it and may
    // re-run it, and a backfill interrupted partway leaves the FK remaps
    // inconsistent with the ids they point at.
    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ULID id migration aborted";
    console.error(message);
    process.exit(1);
  }
}

main();
