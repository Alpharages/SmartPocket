import * as db from "../db";
import type { Id } from "../../drizzle/schema";

/** Seeds default categories for a user; failures are logged and never thrown. */
export async function ensureUserSeeded(userId: Id): Promise<void> {
  try {
    await db.seedDefaultCategories(userId);
    await db.ensureDefaultAccount(userId);
  } catch (err) {
    console.error("[seed] failed to seed default user data", err);
  }
}
