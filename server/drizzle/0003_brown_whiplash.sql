ALTER TABLE `plant_references` ADD `lifecycle` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `planting_notes` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `pruning_notes` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `overwintering_notes` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `native_region` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `deer_resistant` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `drought_tolerant` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `container_suitable` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `attracts_pollinators` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `attracts_birds` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `attracts_butterflies` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `companion_plants` text;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `min_temp_f` integer;--> statement-breakpoint
ALTER TABLE `plant_references` ADD `max_temp_f` integer;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `uv_index` real;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `precipitation_probability` integer;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `soil_temperature` real;--> statement-breakpoint
ALTER TABLE `weather_cache` ADD `wind_gust` real;