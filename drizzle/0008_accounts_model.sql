CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('cash','bank','wallet') NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `categories` MODIFY COLUMN `icon` varchar(50) NOT NULL DEFAULT 'pricetag-outline';--> statement-breakpoint
ALTER TABLE `transactions` ADD `accountId` int;