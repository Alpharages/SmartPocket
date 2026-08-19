import "./load-env.js";
import { formatPhase1Summary, migratePhase1 } from "../server/migrate-phase1";

async function main(): Promise<void> {
  try {
    const steps = await migratePhase1();
    console.log(formatPhase1Summary(steps));
    // dataApi.ts holds an open mysql2 pool, which keeps the event loop alive
    // forever — without this the script prints its summary and then hangs.
    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Phase 1 migration aborted";
    console.error(message);
    process.exit(1);
  }
}

main();
