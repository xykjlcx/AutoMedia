CREATE TABLE `digest_items` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_date` text NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author` text DEFAULT '',
	`ai_score` real NOT NULL,
	`one_liner` text NOT NULL,
	`summary` text NOT NULL,
	`cluster_id` text,
	`cluster_sources` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `digest_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_date` text NOT NULL,
	`status` text NOT NULL,
	`progress` text,
	`raw_count` integer DEFAULT 0,
	`filtered_count` integer DEFAULT 0,
	`started_at` text NOT NULL,
	`completed_at` text,
	`errors` text
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_item_id` text NOT NULL,
	`tags` text DEFAULT '[]',
	`note` text DEFAULT '',
	`created_at` text NOT NULL,
	FOREIGN KEY (`digest_item_id`) REFERENCES `digest_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raw_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`author` text DEFAULT '',
	`raw_data` text,
	`digest_date` text NOT NULL,
	`collected_at` text NOT NULL
);
