-- Phase 4 follow-up (local-first-sync-plan.md, "Purging tombstones" open
-- risk): a global watermark recording the highest serverSeq the tombstone
-- purge job has swept, so a stale device's pull can be detected instead of
-- silently missing a deletion. Singleton row (id = 1), seeded here so
-- `sync.getPurgeWatermark` never has to special-case "no row yet".
CREATE TABLE `syncPurgeWatermark` (
	`id` int NOT NULL,
	`purgedUpToSeq` bigint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `syncPurgeWatermark_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `syncPurgeWatermark` (`id`, `purgedUpToSeq`) VALUES (1, 0);
