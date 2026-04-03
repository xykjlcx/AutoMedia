CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`rating_count` integer DEFAULT 0,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_item_id` text NOT NULL,
	`rating` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`digest_item_id`) REFERENCES `digest_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `digest_items` ADD `trend_tag` text;