-- Phase 4 (local-first sync plan): the sync worker's serverSeq generator.
--
-- `syncSequence` has no purpose beyond handing out ids. A push inserts N
-- blank rows in a single multi-row INSERT and reads back `insertId` — MySQL
-- allocates a contiguous block of AUTO_INCREMENT values for one multi-row
-- INSERT under the default `innodb_autoinc_lock_mode`, so this is atomic and
-- pool-safe without an explicit transaction or a session-scoped
-- `LAST_INSERT_ID()` call.
CREATE TABLE `syncSequence` (
	`seq` bigint AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syncSequence_seq` PRIMARY KEY(`seq`)
);
