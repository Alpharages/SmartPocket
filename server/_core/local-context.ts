import type { Id, User } from "../../drizzle/schema";
import type { TrpcContext } from "./context";
import * as db from "../db";
import { ensureUserSeeded } from "./user-seeding";
import { getLocalOpenId } from "@/lib/local-user";

/**
 * Builds the tRPC context for the in-process link (lib/trpc.native.ts).
 *
 * local-first-sync-plan.md point 3: local reads and writes must never
 * consult the session token. Every call dispatched through the in-process
 * link resolves to the synthetic local user — the device's stable ULID
 * identity (lib/local-user.ts) — never a real signed-in account. `req`/`res`
 * are stubbed the same way the router test suite already does
 * (tests/accounts-router.test.ts): grep across server/routers.ts and
 * server/_core/*.ts confirms neither field is ever read by a procedure.
 */
let ensuredLocalUser: Promise<User> | null = null;

async function ensureLocalUser(): Promise<User> {
  const openId = await getLocalOpenId();
  let user = (await db.getUserByOpenId(openId)) as User | null;

  if (!user) {
    await db.upsertUser({
      openId,
      loginMethod: "local",
      lastSignedIn: new Date(),
    });
    user = (await db.getUserByOpenId(openId)) as User | null;
    if (user?.id) {
      await ensureUserSeeded(user.id);
    }
  }

  if (!user) {
    throw new Error("Failed to create the local device user");
  }
  return user;
}

/** Get-or-create the local user, memoized so repeated calls don't re-hit the DB. */
function getLocalUser(): Promise<User> {
  ensuredLocalUser ??= ensureLocalUser();
  return ensuredLocalUser;
}

export async function createLocalContext(): Promise<TrpcContext> {
  const user = await getLocalUser();
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user,
  };
}

/**
 * The local device user's id — used by the sync worker (lib/sync/sync-worker.ts)
 * to read this device's dirty rows and, on first sync, to re-own them under
 * the signed-in account's id (local-first-sync-plan.md's "signing in later
 * associates that local user with the account").
 */
export async function getLocalUserId(): Promise<Id> {
  const user = await getLocalUser();
  return user.id;
}

/**
 * Associates this device's local user with a signed-in account, so that
 * every subsequent read and write through the in-process link resolves to
 * the account's id — the same id `reownLocalData` re-owns local rows to and
 * the same id every pulled row arrives owned by.
 *
 * Called once per device at first sync (lib/sync/sync-worker.ts), on every
 * branch of the first-sync choice: even "keep the account's data", which
 * discards the local rows rather than re-owning them, still needs the
 * identity moved or the pulled rows would be invisible to the app.
 * Idempotent — re-running after the identity has already moved is a no-op.
 */
export async function adoptAccountIdentity(accountUserId: Id): Promise<void> {
  const local = await getLocalUser();
  if (local.id === accountUserId) return;

  await db.reassignUserId(local.id, accountUserId);
  // The memoized User still carries the pre-association id; drop it so the
  // next context resolution re-reads the row.
  ensuredLocalUser = null;
}

/** Test-only: undo the in-memory memoization between cases. */
export function __resetLocalContextCacheForTests(): void {
  ensuredLocalUser = null;
}
