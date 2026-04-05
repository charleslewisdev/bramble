CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`last_used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);
