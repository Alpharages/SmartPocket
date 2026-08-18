-- Phase 1 (local-first sync plan): ULID id migration, step 2 of 2 — CONTRACT.
--
-- Run this ONLY after `pnpm db:migrate:ulid-ids` (server/migrate-ulid-ids.ts)
-- has completed successfully and its summary counts have been checked against
-- the row counts you expect. This migration is destructive: it drops the
-- original integer id/FK columns and the autoincrement primary keys. There is
-- no automatic rollback — restore from a backup taken before this file runs
-- if something here needs to be undone.
--
-- Each table follows the same four-step shape: drop the constraints tied to
-- the int columns, drop the int columns, rename the "*_ulid" shadow columns
-- into place, then re-add the primary key / NOT NULL / index. FKs are
-- re-declared as ordinary indexes, not `FOREIGN KEY` constraints — the app
-- already enforces ownership at the query layer (every read/write is scoped
-- by `userId`), and a hard FK constraint would fight the tombstone model:
-- a soft-deleted parent row must be able to keep existing while its children
-- are still being tombstoned themselves.

-- ---------------------------------------------------------------- users
ALTER TABLE `users` DROP PRIMARY KEY;
ALTER TABLE `users` DROP COLUMN `id`;
ALTER TABLE `users` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `users` ADD PRIMARY KEY (`id`);

-- ------------------------------------------------------------ categories
ALTER TABLE `categories` DROP PRIMARY KEY;
ALTER TABLE `categories` DROP COLUMN `id`;
ALTER TABLE `categories` DROP COLUMN `userId`;
ALTER TABLE `categories` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `categories` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `categories` ADD PRIMARY KEY (`id`);
ALTER TABLE `categories` ADD INDEX `categories_userId_idx` (`userId`);

-- ------------------------------------------------------------ creditCards
ALTER TABLE `creditCards` DROP PRIMARY KEY;
ALTER TABLE `creditCards` DROP COLUMN `id`;
ALTER TABLE `creditCards` DROP COLUMN `userId`;
ALTER TABLE `creditCards` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `creditCards` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `creditCards` ADD PRIMARY KEY (`id`);
ALTER TABLE `creditCards` ADD INDEX `creditCards_userId_idx` (`userId`);

-- ---------------------------------------------------------------- accounts
ALTER TABLE `accounts` DROP PRIMARY KEY;
ALTER TABLE `accounts` DROP COLUMN `id`;
ALTER TABLE `accounts` DROP COLUMN `userId`;
ALTER TABLE `accounts` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `accounts` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `accounts` ADD PRIMARY KEY (`id`);
ALTER TABLE `accounts` ADD INDEX `accounts_userId_idx` (`userId`);

-- ------------------------------------------------------------------ loans
ALTER TABLE `loans` DROP PRIMARY KEY;
ALTER TABLE `loans` DROP COLUMN `id`;
ALTER TABLE `loans` DROP COLUMN `userId`;
ALTER TABLE `loans` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `loans` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `loans` ADD PRIMARY KEY (`id`);
ALTER TABLE `loans` ADD INDEX `loans_userId_idx` (`userId`);

-- ----------------------------------------------------------- transactions
ALTER TABLE `transactions` DROP PRIMARY KEY;
ALTER TABLE `transactions` DROP COLUMN `id`;
ALTER TABLE `transactions` DROP COLUMN `userId`;
ALTER TABLE `transactions` DROP COLUMN `categoryId`;
ALTER TABLE `transactions` DROP COLUMN `creditCardId`;
ALTER TABLE `transactions` DROP COLUMN `accountId`;
ALTER TABLE `transactions` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `transactions` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `transactions` CHANGE COLUMN `categoryId_ulid` `categoryId` varchar(26) NOT NULL;
ALTER TABLE `transactions` CHANGE COLUMN `creditCardId_ulid` `creditCardId` varchar(26) NULL;
ALTER TABLE `transactions` CHANGE COLUMN `accountId_ulid` `accountId` varchar(26) NULL;
ALTER TABLE `transactions` ADD PRIMARY KEY (`id`);
ALTER TABLE `transactions` ADD INDEX `transactions_userId_idx` (`userId`);
ALTER TABLE `transactions` ADD INDEX `transactions_categoryId_idx` (`categoryId`);
ALTER TABLE `transactions` ADD INDEX `transactions_creditCardId_idx` (`creditCardId`);
ALTER TABLE `transactions` ADD INDEX `transactions_accountId_idx` (`accountId`);

-- --------------------------------------------------- recurringTransactions
ALTER TABLE `recurringTransactions` DROP PRIMARY KEY;
ALTER TABLE `recurringTransactions` DROP COLUMN `id`;
ALTER TABLE `recurringTransactions` DROP COLUMN `userId`;
ALTER TABLE `recurringTransactions` DROP COLUMN `categoryId`;
ALTER TABLE `recurringTransactions` DROP COLUMN `creditCardId`;
ALTER TABLE `recurringTransactions` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `recurringTransactions` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `recurringTransactions` CHANGE COLUMN `categoryId_ulid` `categoryId` varchar(26) NOT NULL;
ALTER TABLE `recurringTransactions` CHANGE COLUMN `creditCardId_ulid` `creditCardId` varchar(26) NULL;
ALTER TABLE `recurringTransactions` ADD PRIMARY KEY (`id`);
ALTER TABLE `recurringTransactions` ADD INDEX `recurringTransactions_userId_idx` (`userId`);

-- ----------------------------------------------------------------- budgets
ALTER TABLE `budgets` DROP PRIMARY KEY;
ALTER TABLE `budgets` DROP COLUMN `id`;
ALTER TABLE `budgets` DROP COLUMN `userId`;
ALTER TABLE `budgets` DROP COLUMN `categoryId`;
ALTER TABLE `budgets` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `budgets` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `budgets` CHANGE COLUMN `categoryId_ulid` `categoryId` varchar(26) NOT NULL;
ALTER TABLE `budgets` ADD PRIMARY KEY (`id`);
ALTER TABLE `budgets` ADD INDEX `budgets_userId_idx` (`userId`);

-- --------------------------------------------------------- monthlySummaries
ALTER TABLE `monthlySummaries` DROP PRIMARY KEY;
ALTER TABLE `monthlySummaries` DROP COLUMN `id`;
ALTER TABLE `monthlySummaries` DROP COLUMN `userId`;
ALTER TABLE `monthlySummaries` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `monthlySummaries` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `monthlySummaries` ADD PRIMARY KEY (`id`);
ALTER TABLE `monthlySummaries` ADD INDEX `monthlySummaries_userId_idx` (`userId`);

-- -------------------------------------------------------------- repayments
ALTER TABLE `repayments` DROP PRIMARY KEY;
ALTER TABLE `repayments` DROP COLUMN `id`;
ALTER TABLE `repayments` DROP COLUMN `loanId`;
ALTER TABLE `repayments` DROP COLUMN `userId`;
ALTER TABLE `repayments` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `repayments` CHANGE COLUMN `loanId_ulid` `loanId` varchar(26) NOT NULL;
ALTER TABLE `repayments` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `repayments` ADD PRIMARY KEY (`id`);
ALTER TABLE `repayments` ADD INDEX `repayments_loanId_idx` (`loanId`);
ALTER TABLE `repayments` ADD INDEX `repayments_userId_idx` (`userId`);

-- --------------------------------------------------------------- transfers
ALTER TABLE `transfers` DROP PRIMARY KEY;
ALTER TABLE `transfers` DROP COLUMN `id`;
ALTER TABLE `transfers` DROP COLUMN `userId`;
ALTER TABLE `transfers` DROP COLUMN `fromAccountId`;
ALTER TABLE `transfers` DROP COLUMN `toAccountId`;
ALTER TABLE `transfers` CHANGE COLUMN `id_ulid` `id` varchar(26) NOT NULL;
ALTER TABLE `transfers` CHANGE COLUMN `userId_ulid` `userId` varchar(26) NOT NULL;
ALTER TABLE `transfers` CHANGE COLUMN `fromAccountId_ulid` `fromAccountId` varchar(26) NOT NULL;
ALTER TABLE `transfers` CHANGE COLUMN `toAccountId_ulid` `toAccountId` varchar(26) NOT NULL;
ALTER TABLE `transfers` ADD PRIMARY KEY (`id`);
ALTER TABLE `transfers` ADD INDEX `transfers_userId_idx` (`userId`);
ALTER TABLE `transfers` ADD INDEX `transfers_fromAccountId_idx` (`fromAccountId`);
ALTER TABLE `transfers` ADD INDEX `transfers_toAccountId_idx` (`toAccountId`);
