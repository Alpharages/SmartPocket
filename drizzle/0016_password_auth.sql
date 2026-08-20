-- Email + password authentication, replacing the Manus OAuth identity provider.
--
-- Hand-written rather than drizzle-kit generated, and deliberately NOT added to
-- drizzle/meta/_journal.json: it belongs to the same phase-1 chain that
-- server/migrate-phase1.ts sequences, which is what a deploy actually runs (see
-- docker-compose.yml's migrate service). Adding it to the journal as well would
-- apply it twice.
--
-- `email` becomes the login identity, so it needs a unique index. It stays
-- NULLable: MySQL permits many NULLs in a unique index, which is what lets a
-- row exist before an address is attached to it. `passwordHash` is likewise
-- NULLable — an account with no password set simply cannot log in, which is the
-- correct state for any row that predates this migration.

ALTER TABLE `users`
  ADD COLUMN `passwordHash` varchar(255) NULL;

CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
