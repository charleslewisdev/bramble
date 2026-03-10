CREATE TABLE `care_task_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`care_task_id` integer NOT NULL,
	`action` text DEFAULT 'completed' NOT NULL,
	`notes` text,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`care_task_id`) REFERENCES `care_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `care_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_instance_id` integer,
	`zone_id` integer,
	`location_id` integer,
	`task_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`interval_days` integer,
	`active_months` text,
	`send_notification` integer DEFAULT true NOT NULL,
	`plant_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plant_instance_id`) REFERENCES `plant_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`hardiness_zone` text,
	`last_frost_date` text,
	`first_frost_date` text,
	`lot_boundary` text,
	`lot_width` real,
	`lot_depth` real,
	`compass_orientation` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plant_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_reference_id` integer NOT NULL,
	`zone_id` integer,
	`nickname` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`is_container` integer DEFAULT false NOT NULL,
	`container_description` text,
	`date_planted` text,
	`date_removed` text,
	`notes` text,
	`mood` text DEFAULT 'happy' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plant_reference_id`) REFERENCES `plant_references`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `plant_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_instance_id` integer NOT NULL,
	`filename` text NOT NULL,
	`caption` text,
	`taken_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plant_instance_id`) REFERENCES `plant_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plant_references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`common_name` text NOT NULL,
	`latin_name` text,
	`cultivar` text,
	`family` text,
	`plant_type` text,
	`sun_requirement` text,
	`water_needs` text,
	`soil_preference` text,
	`hardiness_zone_min` integer,
	`hardiness_zone_max` integer,
	`mature_height` text,
	`mature_spread` text,
	`growth_rate` text,
	`bloom_time` text,
	`bloom_color` text,
	`foliage_type` text,
	`toxicity_dogs` text DEFAULT 'safe',
	`toxicity_cats` text DEFAULT 'safe',
	`toxicity_children` text DEFAULT 'safe',
	`toxicity_notes` text,
	`sprite_type` text DEFAULT 'flower',
	`source` text DEFAULT 'user',
	`external_id` text,
	`description` text,
	`care_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`notes` text,
	`plant_reference_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plant_reference_id`) REFERENCES `plant_references`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `structures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` integer NOT NULL,
	`name` text NOT NULL,
	`pos_x` real DEFAULT 0 NOT NULL,
	`pos_y` real DEFAULT 0 NOT NULL,
	`width` real NOT NULL,
	`depth` real NOT NULL,
	`height` real DEFAULT 10 NOT NULL,
	`stories` integer DEFAULT 1 NOT NULL,
	`roof_type` text DEFAULT 'gable' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weather_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` integer NOT NULL,
	`temperature` real,
	`temperature_high` real,
	`temperature_low` real,
	`humidity` real,
	`precipitation` real,
	`wind_speed` real,
	`conditions` text,
	`forecast_json` text,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`pos_x` real DEFAULT 0 NOT NULL,
	`pos_y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 10 NOT NULL,
	`depth` real DEFAULT 10 NOT NULL,
	`sun_exposure` text DEFAULT 'partial_sun',
	`soil_type` text,
	`moisture_level` text,
	`wind_exposure` text,
	`is_indoor` integer DEFAULT false NOT NULL,
	`notes` text,
	`color` text DEFAULT '#4ade80',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
