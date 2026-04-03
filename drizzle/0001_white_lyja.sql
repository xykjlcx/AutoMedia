CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'anthropic' NOT NULL,
	`base_url` text DEFAULT '',
	`api_key` text DEFAULT '',
	`fast_model` text DEFAULT 'claude-haiku-4-5-20251001' NOT NULL,
	`quality_model` text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	`updated_at` text NOT NULL
);
