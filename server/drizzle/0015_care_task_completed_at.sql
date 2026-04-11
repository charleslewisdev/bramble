ALTER TABLE `care_tasks` ADD `completed_at` text;--> statement-breakpoint
CREATE INDEX `care_tasks_completed_at_idx` ON `care_tasks` (`completed_at`);--> statement-breakpoint
-- Backfill: mark any non-recurring task that already has a completed or
-- skipped log row as done, using the most recent log timestamp.
-- Note: care_task_logs uses `completed_at` as the timestamp column name,
-- not `created_at`.
UPDATE `care_tasks`
SET `completed_at` = (
  SELECT MAX(`completed_at`) FROM `care_task_logs`
  WHERE `care_task_logs`.`care_task_id` = `care_tasks`.`id`
    AND `care_task_logs`.`action` IN ('completed', 'skipped')
)
WHERE `is_recurring` = 0
  AND `completed_at` IS NULL
  AND EXISTS (
    SELECT 1 FROM `care_task_logs`
    WHERE `care_task_logs`.`care_task_id` = `care_tasks`.`id`
      AND `care_task_logs`.`action` IN ('completed', 'skipped')
  );
