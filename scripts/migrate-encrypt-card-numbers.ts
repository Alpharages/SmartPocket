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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Card encryption migration aborted";
    console.error(message);
    process.exit(1);
  }
}

main();
