CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`avatar_url` text,
	`last_login_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`expires_at` text NOT NULL,
	`user_agent` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`role` text NOT NULL,
	`created_by` integer NOT NULL REFERENCES `users`(`id`),
	`claimed_by` integer REFERENCES `users`(`id`),
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `invites_token_idx` ON `invites` (`token`);--> statement-breakpoint
ALTER TABLE `plant_photos` ADD `created_by` integer REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `care_task_logs` ADD `created_by` integer REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `created_by` integer REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `shopping_list_items` ADD `created_by` integer REFERENCES `users`(`id`) ON DELETE set null;
