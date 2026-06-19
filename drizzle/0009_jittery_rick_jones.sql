CREATE TABLE `transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fromAccountId` int NOT NULL,
	`toAccountId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`description` text,
	`date` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transfers_id` PRIMARY KEY(`id`)
);
