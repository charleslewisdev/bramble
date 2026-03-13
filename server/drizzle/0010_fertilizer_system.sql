-- Fertilizer inventory table
CREATE TABLE `fertilizers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` integer NOT NULL REFERENCES `locations`(`id`) ON DELETE cascade,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`npk_n` real,
	`npk_p` real,
	`npk_k` real,
	`organic` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'have_it' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fertilizers_location_id_idx` ON `fertilizers` (`location_id`);
--> statement-breakpoint
-- Add fertilizer guidance columns to plant_references
ALTER TABLE `plant_references` ADD `fertilizer_type` text;
--> statement-breakpoint
ALTER TABLE `plant_references` ADD `fertilizer_npk` text;
--> statement-breakpoint
ALTER TABLE `plant_references` ADD `fertilizer_frequency` text;
--> statement-breakpoint
ALTER TABLE `plant_references` ADD `fertilizer_notes` text;
