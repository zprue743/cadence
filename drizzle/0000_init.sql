CREATE TABLE `dependencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roadmap_id` integer NOT NULL,
	`from_event` integer NOT NULL,
	`to_event` integer NOT NULL,
	`type` integer DEFAULT 2 NOT NULL,
	`lag` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roadmap_id` integer NOT NULL,
	`parent_id` integer,
	`parent_index` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`duration` real,
	`percent_done` real DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`manually_scheduled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
