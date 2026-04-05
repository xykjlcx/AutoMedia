CREATE TABLE IF NOT EXISTS `daily_tldrs` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_date` text NOT NULL,
	`headline` text NOT NULL,
	`items` text NOT NULL,
	`observation` text NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_daily_tldrs_date` ON `daily_tldrs` (`digest_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entity_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_notified_at` text,
	`notify_count` integer DEFAULT 0,
	FOREIGN KEY (`entity_id`) REFERENCES `topic_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_entity_subscriptions_entity` ON `entity_subscriptions` (`entity_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reading_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_item_id` text NOT NULL,
	`added_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`digest_item_id`) REFERENCES `digest_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_reading_queue_item` ON `reading_queue` (`digest_item_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `style_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`profile` text NOT NULL,
	`sample_count` integer DEFAULT 0,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `weekly_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`week_end` text NOT NULL,
	`content` text NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_weekly_insights_week` ON `weekly_insights` (`week_start`);
