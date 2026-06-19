CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`direction` enum('lend','borrow') NOT NULL,
	`counterparty` varchar(100),
	`principal` decimal(12,2) NOT NULL,
	`rate` decimal(5,2),
	`periodicity` enum('weekly','monthly','yearly','none') NOT NULL,
	`installmentCount` int,
	`endDate` timestamp,
	`nextDueDate` timestamp,
	`status` enum('active','settled') NOT NULL DEFAULT 'active',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`date` timestamp NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `repayments_id` PRIMARY KEY(`id`)
);
