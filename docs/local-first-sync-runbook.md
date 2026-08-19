# Local-first sync — deployment runbook

Companion to `local-first-sync-plan.md`. That document is the design; this one
is what you actually run, in what order, to put it on a server.

## The one thing that will bite you

**`pnpm db:push` does not migrate this feature.** Migrations `0011`–`0014` are
deliberately absent from `drizzle/meta/_journal.json`, so `drizzle-kit migrate`
skips them entirely.

That is not an oversight. `0012_ulid_ids_contract.sql` drops the integer id
columns and renames the ULID shadow columns into their place — and it is only
safe to run **after** `server/migrate-ulid-ids.ts` has minted a ULID for every
row and rewritten every foreign key. drizzle-kit cannot interleave application
code between two SQL files, so journaling them would let `pnpm db:push` contract
against un-backfilled columns and drop every id in the database.

The ordering lives in `server/migrate-phase1.ts` instead:

```
pnpm db:migrate:phase1
```

## What that command does

| Step | What runs | Why it can't be plain SQL |
|---|---|---|
| 1 | `0011_ulid_shadow_columns.sql` — adds nullable `*_ulid` shadow columns plus `deletedAt` / `dirty` / `serverSeq` | — |
| 2 | `server/migrate-ulid-ids.ts` — mints a ULID per row, remaps every FK | Minting a ULID is application logic |
| 3 | **Verify** — refuses to continue if any shadow column is still NULL where its int source is not | Guards against a half-finished backfill |
| 4 | `0012_ulid_ids_contract.sql` — drops the int columns, renames the shadow columns in | Destructive; must follow step 2 |
| 5 | `0013_sync_sequence.sql`, `0014_sync_purge_watermark.sql` | — |

Every step is guarded by a **state check on the database itself**, not a ledger,
so the command is safe to re-run: a fully migrated database reports every step
as already applied, and a database that failed partway resumes where it stopped.

## Before you run it

1. **Take a backup.** Step 4 is destructive and has no automatic rollback.
   ```
   mysqldump -h<host> -u<user> -p <database> > pre-phase1.sql
   ```
2. Check the backfill summary the command prints against the row counts you
   expect. It lists ids minted per table and foreign keys remapped per column.
   A column reading `0` where you expected rows means the FK was already NULL
   for all of them — worth confirming that is true before continuing.

If step 3 fails, the command aborts **before** anything destructive happens.
Fix the cause, re-run; nothing has been dropped.

## Deploy order

The ULID change is not backwards compatible — a server still running the old
build writes integer ids that the new schema has no column for.

1. Take the backup.
2. Stop the old server (or put it in maintenance).
3. `pnpm db:migrate:phase1`
4. Deploy the new build.

Client apps do not need a coordinated release: a device that has never synced
holds only local rows, and the first-sync choice reconciles it whenever the user
turns sync on.

## Verifying afterwards

```sql
-- ids are ULIDs, not ints
DESCRIBE transactions;              -- id should be varchar(26)

-- no foreign key was orphaned by the remap
SELECT COUNT(*) FROM transactions WHERE categoryId NOT IN (SELECT id FROM categories);
SELECT COUNT(*) FROM transactions WHERE userId     NOT IN (SELECT id FROM users);

-- the sync tables exist
SHOW TABLES LIKE 'sync%';           -- syncSequence, syncPurgeWatermark
```

Both orphan counts must be `0`.

## Tombstone purging

`purgeOldTombstones` (`server/_core/sync-engine.ts`) hard-deletes rows that have
been tombstoned longer than a retention window, and advances
`syncPurgeWatermark`. Nothing schedules it — wire it to whatever cron you use,
or don't run it at all (tombstones are small).

The retention window must be longer than any plausible offline period. Devices
that fall behind the watermark are not silently corrupted: the sync worker
detects it and re-prompts with the first-sync-style choice
(`reason: "stale-cursor"`). Shorter windows just mean more of those prompts.

## Card encryption keys

Card numbers are encrypted with a **per-account key**, stored on `users.cardKey`
and handed to authenticated devices over the existing session
(`security.getCardKey`). It is minted on first use, so no migration is needed —
see `server/_core/card-key.ts` for why the old global `CARD_ENCRYPTION_KEY` env
var is still read as a decrypt-only fallback, and keep it set until you are
confident no rows predate the per-account key.
