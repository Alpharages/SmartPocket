-- Phase 1 (local-first sync plan): ULID id migration, step 1 of 2 — EXPAND.
--
-- Hand-written, not drizzle-kit generated: converting an autoincrement PK to a
-- client-generated ULID while preserving every foreign-key relationship is a
-- data migration, not a schema diff drizzle-kit can produce on its own. The
-- safe path for a populated table is expand -> backfill -> contract:
--
--   1. EXPAND (this file): add nullable "*_ulid" shadow columns alongside the
--      existing integer id/FK columns, plus the three sync columns every
--      synced table needs. Nothing here can break current reads or writes —
--      every existing statement in server/db.ts keeps compiling and running
--      exactly as before against the untouched original columns.
--   2. BACKFILL (`pnpm db:migrate:ulid-ids`, server/migrate-ulid-ids.ts):
--      mints a ULID into every row's *_ulid column and rewrites every FK
--      shadow column to point at the new id, entirely in application code —
--      SQL alone cannot generate a ULID.
--   3. CONTRACT (0012_ulid_ids_contract.sql): drop the old int columns, rename
--      the shadow columns to the canonical names, and (re)add the primary key
--      and indexes. Run 0012 ONLY after the backfill script has completed and
--      its summary has been reviewed — it is destructive and not reversible
--      without a backup.
--
-- `dirty` defaults to 1 to mirror drizzle/schema.ts's column default (the
-- value new locally-created rows get once Phase 3/4 land). The column is
-- inert on the server until then — nothing reads it yet — so the default
-- assigned to today's existing rows has no behavioural effect either way.

-- users: referenced by every other table's userId, so its id must be
-- backfilled first. No sync columns — an account row isn't a synced record.
ALTER TABLE `users`
  ADD COLUMN `id_ulid` varchar(26) NULL;

ALTER TABLE `categories`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `creditCards`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `accounts`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `loans`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `transactions`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `categoryId_ulid` varchar(26) NULL,
  ADD COLUMN `creditCardId_ulid` varchar(26) NULL,
  ADD COLUMN `accountId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `recurringTransactions`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `categoryId_ulid` varchar(26) NULL,
  ADD COLUMN `creditCardId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `budgets`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `categoryId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `monthlySummaries`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `repayments`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `loanId_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;

ALTER TABLE `transfers`
  ADD COLUMN `id_ulid` varchar(26) NULL,
  ADD COLUMN `userId_ulid` varchar(26) NULL,
  ADD COLUMN `fromAccountId_ulid` varchar(26) NULL,
  ADD COLUMN `toAccountId_ulid` varchar(26) NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `dirty` boolean NOT NULL DEFAULT 1,
  ADD COLUMN `serverSeq` bigint NULL;
