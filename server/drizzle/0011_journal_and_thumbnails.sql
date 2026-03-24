ALTER TABLE `plant_photos` ADD `thumbnail_filename` text;--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_instance_id` integer REFERENCES `plant_instances`(`id`) ON DELETE cascade,
	`zone_id` integer REFERENCES `zones`(`id`) ON DELETE set null,
	`location_id` integer REFERENCES `locations`(`id`) ON DELETE set null,
	`entry_type` text NOT NULL,
	`title` text,
	`body` text,
	`care_task_log_id` integer REFERENCES `care_task_logs`(`id`) ON DELETE set null,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `journal_entries_plant_instance_id_idx` ON `journal_entries` (`plant_instance_id`);--> statement-breakpoint
CREATE INDEX `journal_entries_zone_id_idx` ON `journal_entries` (`zone_id`);--> statement-breakpoint
CREATE INDEX `journal_entries_location_id_idx` ON `journal_entries` (`location_id`);--> statement-breakpoint
CREATE INDEX `journal_entries_created_at_idx` ON `journal_entries` (`created_at`);--> statement-breakpoint
CREATE TABLE `journal_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journal_entry_id` integer NOT NULL REFERENCES `journal_entries`(`id`) ON DELETE cascade,
	`plant_photo_id` integer NOT NULL REFERENCES `plant_photos`(`id`) ON DELETE cascade,
	`sort_order` integer DEFAULT 0 NOT NULL
);