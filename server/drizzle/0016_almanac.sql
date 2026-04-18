CREATE TABLE `almanac_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`content` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `almanac_entries_slug_unique` ON `almanac_entries` (`slug`);--> statement-breakpoint
CREATE INDEX `almanac_entries_slug_idx` ON `almanac_entries` (`slug`);--> statement-breakpoint
CREATE INDEX `almanac_entries_updated_at_idx` ON `almanac_entries` (`updated_at`);--> statement-breakpoint
CREATE TABLE `almanac_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `almanac_tags_name_unique` ON `almanac_tags` (`name`);--> statement-breakpoint
CREATE TABLE `almanac_entry_tags` (
	`entry_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `almanac_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `almanac_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `almanac_entry_tags_entry_id_idx` ON `almanac_entry_tags` (`entry_id`);--> statement-breakpoint
CREATE INDEX `almanac_entry_tags_tag_id_idx` ON `almanac_entry_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `almanac_entry_tags_entry_tag_unique` ON `almanac_entry_tags` (`entry_id`, `tag_id`);--> statement-breakpoint
CREATE TABLE `almanac_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `almanac_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `almanac_images_entry_id_idx` ON `almanac_images` (`entry_id`);
