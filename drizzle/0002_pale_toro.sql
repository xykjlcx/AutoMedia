CREATE TABLE `schedule_config` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false,
	`cron_expression` text DEFAULT '0 6 * * *',
	`telegram_enabled` integer DEFAULT false,
	`telegram_bot_token` text DEFAULT '',
	`telegram_chat_id` text DEFAULT '',
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '📰' NOT NULL,
	`type` text NOT NULL,
	`rss_path` text DEFAULT '',
	`rss_url` text DEFAULT '',
	`target_url` text DEFAULT '',
	`enabled` integer DEFAULT true,
	`max_items` integer DEFAULT 5,
	`sort_order` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `digest_items` ADD `is_read` integer DEFAULT false;