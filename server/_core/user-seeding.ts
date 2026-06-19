import * as db from "../db";

/** Seeds default categories for a user; failures are logged and never thrown. */
export async function ensureUserSeeded(userId: number): Promise<void> {
  try {
    await db.seedDefaultCategories(userId);
    await db.ensureDefaultAccount(userId);
  } catch (err) {
    console.error("[seed] failed to seed default user data", err);
  }
}
