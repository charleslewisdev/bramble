ALTER TABLE `zones` ADD `zone_type` text DEFAULT 'bed' NOT NULL;--> statement-breakpoint
ALTER TABLE `zones` ADD `climbing_structure` text;--> statement-breakpoint
ALTER TABLE `zones` ADD `has_patio` integer DEFAULT false NOT NULL;