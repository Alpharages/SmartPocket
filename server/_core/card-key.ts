import { randomBytes } from "@noble/ciphers/utils.js";
import { dbQuery } from "./db-query";
import { allocateServerSeqBlock } from "./sync-engine";
import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedCardNumber,
} from "./card-cipher";
import { bytesToBase64, base64ToBytes } from "../../shared/base64";
import type { Id } from "../../drizzle/schema";

/**
 * The per-account card-number key — local-first-sync-plan.md blocker 3.
 *
 * Before this existed, card numbers were encrypted with two keys that could
 * never agree: a global `CARD_ENCRYPTION_KEY` env var on the server, and a
 * per-device random key on the phone (`crypto.native.ts`). Sync makes that
 * untenable in both directions — ciphertext pushed from a device is
 * unreadable by the server, and a card added on phone A is undecryptable on
 * phone B. The plan's wording is exact: "the key has to be derived from
 * account credentials, not generated per-device."
 *
 * A key per *account*, not a single global one, is the reason this is stored
 * on the user row instead of just handing devices the env var. The env key is
 * shared by every account, so shipping it to every signed-in phone would mean
 * one compromised device exposes every user's cards. An account key reaches
 * only the devices already entitled to that account's data.
 *
 * Minted lazily on first use, so there is no backfill and no deploy-time
 * migration: accounts that never touch a card never get one, and rows written
 * before this column existed keep decrypting under the env key (see
 * `crypto.ts`'s fallback).
 */
const KEY_BYTES = 32;

/**
 * Returns this account's card key, minting and persisting one if the account
 * does not have it yet.
 *
 * The `UPDATE ... WHERE cardKey IS NULL` is what makes a race harmless: two
 * concurrent requests can both mint a candidate, but only the first write
 * lands, and both then re-read the row to find whichever key won. Minting a
 * key is cheap; using two different ones for the same account would not be.
 */
export async function getOrCreateAccountCardKey(
  userId: Id,
): Promise<Uint8Array> {
  const existing = await readCardKey(userId);
  if (existing) return existing;

  const minted = bytesToBase64(randomBytes(KEY_BYTES));
  await dbQuery("Database/query", {
    body: {
      query: "UPDATE users SET cardKey = ? WHERE id = ? AND cardKey IS NULL",
      params: [minted, userId],
    },
  });

  const stored = await readCardKey(userId);
  if (!stored) {
    throw new Error(
      `Failed to mint a card encryption key for user ${userId} — no such user?`,
    );
  }
  return stored;
}

async function readCardKey(userId: Id): Promise<Uint8Array | null> {
  const rows = (await dbQuery("Database/query", {
    body: {
      query: "SELECT cardKey FROM users WHERE id = ?",
      params: [userId],
    },
  })) as Array<{ cardKey: string | null }>;

  const raw = rows[0]?.cardKey;
  return raw ? base64ToBytes(raw) : null;
}

/** The account key as base64, for handing to an authenticated device. */
export async function getAccountCardKeyBase64(userId: Id): Promise<string> {
  return bytesToBase64(await getOrCreateAccountCardKey(userId));
}

/**
 * Re-encrypts card numbers still sitting under the old global env key so they
 * are readable under their owner's account key.
 *
 * `crypto.ts` falls back to the env key when the account key cannot open a
 * value, so the *server* reads these rows fine and nothing looks wrong there.
 * Devices are where it breaks: a phone pulls the row and holds no env key at
 * all, so the PAN is simply unreadable on every device on the account — and
 * the failure is silent until someone opens the card. Converting them here,
 * once, is the only place with both keys in hand.
 *
 * Rows already under the account key are left alone, so this is a no-op on a
 * second run. Rows that open under neither key are counted and skipped rather
 * than throwing — one unreadable card must not abort the migration.
 */
export async function reencryptLegacyCardNumbers(
  legacyKey: Uint8Array | null,
): Promise<{ converted: number; alreadyCurrent: number; unreadable: number }> {
  const rows = (await dbQuery("Database/query", {
    body: {
      query:
        "SELECT id, userId, cardNumber FROM creditCards WHERE cardNumber IS NOT NULL",
      params: [],
    },
  })) as Array<{ id: Id; userId: Id; cardNumber: string }>;

  let converted = 0;
  let alreadyCurrent = 0;
  let unreadable = 0;

  for (const row of rows) {
    // Plaintext rows predate encryption entirely; `decryptCardNumber` passes
    // them through untouched on every platform, so they are not a problem.
    if (!isEncryptedCardNumber(row.cardNumber)) continue;

    const accountKey = await getOrCreateAccountCardKey(row.userId);
    try {
      decryptWithKey(row.cardNumber, accountKey);
      alreadyCurrent++;
      continue;
    } catch {
      // Not under the account key — try the legacy one below.
    }

    if (!legacyKey) {
      unreadable++;
      continue;
    }

    let plain: string;
    try {
      plain = decryptWithKey(row.cardNumber, legacyKey);
    } catch {
      unreadable++;
      continue;
    }

    // A new `serverSeq` and a fresh `updatedAt`, not just the new ciphertext.
    // Devices that already pulled the old value are past this row's old seq,
    // so without a new one they never see the corrected copy; and
    // `applyIncomingRow` resolves conflicts by last-write-wins on
    // `updatedAt`, so an unbumped timestamp would make every device reject
    // the fix as older than the unreadable row it already holds.
    const [seq] = [await allocateServerSeqBlock(1)];
    await dbQuery("Database/query", {
      body: {
        query:
          "UPDATE creditCards SET cardNumber = ?, serverSeq = ?, updatedAt = NOW() WHERE id = ?",
        params: [encryptWithKey(plain, accountKey), seq, row.id],
      },
    });
    converted++;
  }

  return { converted, alreadyCurrent, unreadable };
}
