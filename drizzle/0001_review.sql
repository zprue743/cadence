CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug` ON `teams` (`slug`);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_team_email` ON `members` (`team_id`, `email`);
--> statement-breakpoint
INSERT INTO `teams` (`name`, `slug`)
SELECT 'Platform', 'platform'
WHERE NOT EXISTS (SELECT 1 FROM `teams` WHERE `slug` = 'platform');
--> statement-breakpoint
ALTER TABLE `roadmaps` ADD COLUMN `team_id` integer REFERENCES `teams`(`id`);
--> statement-breakpoint
UPDATE `roadmaps` SET `team_id` = (SELECT `id` FROM `teams` WHERE `slug` = 'platform') WHERE `team_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `success_criteria` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `gitlab_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roadmap_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`author_email` text NOT NULL,
	`source_revision` integer NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `snapshot_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`source_task_id` integer NOT NULL,
	`parent_source_task_id` integer,
	`parent_index` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`duration` real,
	`percent_done` real DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`manually_scheduled` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`success_criteria` text DEFAULT '' NOT NULL,
	`gitlab_url` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `snapshot_dependencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`source_dependency_id` integer NOT NULL,
	`from_source_task_id` integer NOT NULL,
	`to_source_task_id` integer NOT NULL,
	`type` integer DEFAULT 2 NOT NULL,
	`lag` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
