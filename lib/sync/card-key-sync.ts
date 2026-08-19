import { callDataApi } from "@/server/_core/dataApi";
import {
  adoptAccountCardKey,
  hasAccountCardKey,
  reencryptUnderAccountKey,
} from "@/server/_core/crypto.native";
import type { Id } from "@/drizzle/schema";
import type { RemoteSyncClient } from "./remote-client";

/**
 * The one-time switch from this device's own card key to the account's —
 * local-first-sync-plan.md blocker 3, closed at the moment the plan says it
 * has to be: "signing in later associates that local user with the account."
 *
 * Every card this device stored while it was signed out is encrypted under a
 * random key that exists nowhere else. Pushing those rows as-is would put
 * ciphertext on the server that neither the server nor any other device could
 * ever read — and unlike a lost row, that failure is silent until someone
 * opens the card months later. So the rows are rewritten under the account
 * key *before* the first push, and before the account key becomes current.
 *
 * Ordering is the whole design here. Re-encrypt first, adopt second: if this
 * is interrupted partway, the account key is still not current, so the next
 * attempt starts over from a database that is entirely device-key encrypted.
 * Adopting first and re-encrypting second would leave a half-converted
 * database indistinguishable from a converted one.
 */
export async function adoptAccountCardKeyForDevice(
  client: RemoteSyncClient,
  userId: Id,
): Promise<{ reencrypted: number } | null> {
  if (await hasAccountCardKey()) return null;

  const accountKey = await client.security.getCardKey.query();

  const rows = (await callDataApi("Database/query", {
    body: {
      query: "SELECT id, cardNumber FROM creditCards WHERE cardNumber IS NOT NULL",
      params: [],
    },
  })) as Array<{ id: Id; cardNumber: string }>;

  let reencrypted = 0;
  for (const row of rows) {
    const rewritten = await reencryptUnderAccountKey(
      row.cardNumber,
      accountKey,
    );
    if (rewritten === row.cardNumber) continue;

    // `dirty = 1` so the re-encrypted value actually reaches the account. A
    // card that had already synced under the device key is otherwise clean,
    // and would leave the unreadable ciphertext sitting on the server.
    await callDataApi("Database/query", {
      body: {
        query: "UPDATE creditCards SET cardNumber = ?, dirty = 1 WHERE id = ?",
        params: [rewritten, row.id],
      },
    });
    reencrypted++;
  }

  await adoptAccountCardKey(accountKey);
  return { reencrypted };
}
