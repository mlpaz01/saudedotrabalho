CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`certificateCode` varchar(64) NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`pdfUrl` varchar(1024),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificateCode_unique` UNIQUE(`certificateCode`)
);
--> statement-breakpoint
CREATE TABLE `corporate_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(255),
	`sector` varchar(255),
	`employeeName` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`hasSetPassword` boolean NOT NULL DEFAULT false,
	`passwordHash` varchar(255),
	`userId` int,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`lastAccessAt` timestamp,
	CONSTRAINT `corporate_emails_id` PRIMARY KEY(`id`),
	CONSTRAINT `corporate_emails_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `decompression_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('yoga','meditacao','respiracao','outro') NOT NULL,
	`videoUrl` varchar(1024),
	`thumbnailUrl` varchar(1024),
	`durationMinutes` int DEFAULT 0,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decompression_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`type` enum('reminder_employee','alert_rh','welcome') NOT NULL,
	`subject` varchar(512),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderIndex` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`videoUrl` varchar(1024),
	`thumbnailUrl` varchar(1024),
	`durationMinutes` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inactiveDaysThreshold` int NOT NULL DEFAULT 7,
	`lowEngagementThreshold` float NOT NULL DEFAULT 30,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`percentWatched` float NOT NULL DEFAULT 0,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`lastWatchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','rh') NOT NULL DEFAULT 'user';