import "./load-env.js";
import {
  formatUlidMigrationSummary,
  migrateUlidIds,
} from "../server/migrate-ulid-ids";

async function main(): Promise<void> {
  try {
    const summary = await migrateUlidIds();
    console.log(formatUlidMigrationSummary(summary));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ULID id migration aborted";
    console.error(message);
    process.exit(1);
  }
}

main();
