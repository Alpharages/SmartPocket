import "./load-env.js";
import {
  formatMigrationSummary,
  migrateEncryptCardNumbers,
} from "../server/migrate-encrypt-card-numbers";

async function main(): Promise<void> {
  try {
    const summary = await migrateEncryptCardNumbers();
    console.log(formatMigrationSummary(summary));
    if (summary.failed > 0) {
      process.exit(1);
    }
    // See the note in migrate-ulid-ids.ts: dataApi.ts's mysql2 pool keeps the
    // event loop alive, so the script must exit explicitly on success.
    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Card encryption migration aborted";
    console.error(message);
    process.exit(1);
  }
}

main();
