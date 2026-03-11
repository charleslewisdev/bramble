CREATE INDEX `care_task_logs_care_task_id_idx` ON `care_task_logs` (`care_task_id`);--> statement-breakpoint
CREATE INDEX `care_tasks_plant_instance_id_idx` ON `care_tasks` (`plant_instance_id`);--> statement-breakpoint
CREATE INDEX `care_tasks_zone_id_idx` ON `care_tasks` (`zone_id`);--> statement-breakpoint
CREATE INDEX `care_tasks_due_date_idx` ON `care_tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `plant_instances_zone_id_idx` ON `plant_instances` (`zone_id`);--> statement-breakpoint
CREATE INDEX `plant_instances_ref_id_idx` ON `plant_instances` (`plant_reference_id`);--> statement-breakpoint
CREATE INDEX `plant_refs_common_name_idx` ON `plant_references` (`common_name`);--> statement-breakpoint
CREATE INDEX `plant_refs_external_id_idx` ON `plant_references` (`external_id`);--> statement-breakpoint
CREATE INDEX `weather_cache_location_fetched_idx` ON `weather_cache` (`location_id`,`fetched_at`);--> statement-breakpoint
CREATE INDEX `zones_location_id_idx` ON `zones` (`location_id`);