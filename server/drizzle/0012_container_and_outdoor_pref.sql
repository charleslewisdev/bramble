ALTER TABLE `plant_instances` ADD `container_size` text;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `container_shape` text;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `container_material` text;--> statement-breakpoint
ALTER TABLE `plant_instances` ADD `outdoor_candidate` integer DEFAULT false NOT NULL;
