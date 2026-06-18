CREATE TABLE IF NOT EXISTS `training_programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int,
	`name` varchar(255) NOT NULL,
	`code` varchar(50),
	`technical_title` varchar(255),
	`description` text,
	`type` varchar(20) NOT NULL DEFAULT 'obrigatorio',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`order_index` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `training_programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `training_program_factors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`program_id` int NOT NULL,
	`factor_id` int NOT NULL,
	CONSTRAINT `training_program_factors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `training_program_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`program_id` int NOT NULL,
	`module_id` int NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	CONSTRAINT `training_program_modules_id` PRIMARY KEY(`id`)
);
