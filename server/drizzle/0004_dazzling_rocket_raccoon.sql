CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`task_ids` text,
	`success` integer NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`digest_time` text DEFAULT '08:00',
	`frequency` text DEFAULT 'daily_digest' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_task_type_unique` ON `notification_preferences` (`task_type`);--> statement-breakpoint
ALTER TABLE `care_task_logs` ADD `photo_id` integer REFERENCES plant_photos(id);--> statement-breakpoint
ALTER TABLE `care_tasks` ADD `last_notified_at` text;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_water` integer;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_fertilize` integer;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_prune` integer;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_repot` integer;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_inspect` integer;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `notify_protect` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_water` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_fertilize` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_prune` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_repot` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_inspect` integer;--> statement-breakpoint
ALTER TABLE `zones` ADD `notify_protect` integer;