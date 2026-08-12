ALTER TABLE `users` ADD `pinHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `pinFailedAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pinLockedUntil` timestamp;