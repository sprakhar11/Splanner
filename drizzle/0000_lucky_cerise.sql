CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`icon_name` text DEFAULT 'folder' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dsa_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`difficulty` text DEFAULT 'MEDIUM' NOT NULL,
	`platform` text DEFAULT 'LEETCODE' NOT NULL,
	`category_pattern` text DEFAULT '',
	`time_taken_minutes` integer DEFAULT 0,
	`mistakes_notes` text DEFAULT '',
	`solution_snippet` text DEFAULT '',
	`url` text DEFAULT '',
	`revision_due` text,
	`status` text DEFAULT 'ATTEMPTED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hr_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`question_category` text NOT NULL,
	`situation` text DEFAULT '',
	`task` text DEFAULT '',
	`action` text DEFAULT '',
	`result` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `hr_story_tags` (
	`hr_story_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`hr_story_id`) REFERENCES `hr_stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lld_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`pattern` text NOT NULL,
	`description` text DEFAULT '',
	`code_snippet` text DEFAULT '',
	`status` text DEFAULT 'BACKLOG' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_tags` (
	`note_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '',
	`type` text DEFAULT 'GENERAL' NOT NULL,
	`category_id` text,
	`code_language` text,
	`links` text DEFAULT '[]',
	`image_uris` text DEFAULT '[]',
	`is_favorite` integer DEFAULT false NOT NULL,
	`revision_scheduled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '',
	`type` text NOT NULL,
	`task_id` text,
	`revision_item_id` text,
	`timestamp` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`tasks_completed_count` integer DEFAULT 0 NOT NULL,
	`hours_studied` real DEFAULT 0 NOT NULL,
	`problems_solved_count` integer DEFAULT 0 NOT NULL,
	`learned_summary` text DEFAULT '',
	`struggled_summary` text DEFAULT '',
	`mood` integer DEFAULT 3 NOT NULL,
	`gratitude` text DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflections_date_unique` ON `reflections` (`date`);--> statement-breakpoint
CREATE TABLE `revision_history` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_item_id` text NOT NULL,
	`date` text NOT NULL,
	`grade` text NOT NULL,
	`interval_days` integer NOT NULL,
	FOREIGN KEY (`revision_item_id`) REFERENCES `revision_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `revision_item_tags` (
	`revision_item_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`revision_item_id`) REFERENCES `revision_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `revision_items` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text,
	`title` text NOT NULL,
	`concept` text DEFAULT '',
	`code_snippet` text,
	`current_step_index` integer DEFAULT 0 NOT NULL,
	`next_due_date` text NOT NULL,
	`last_revised_date` text,
	`total_revisions` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`minutes` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`task_id` text,
	`note` text DEFAULT '',
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_design` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`notes` text DEFAULT '',
	`key_tradeoffs` text DEFAULT '[]',
	`is_revised` integer DEFAULT false NOT NULL,
	`last_revised` text
);
--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`priority` text DEFAULT 'P3' NOT NULL,
	`category_id` text,
	`estimated_minutes` integer DEFAULT 30 NOT NULL,
	`actual_minutes` integer,
	`deadline` integer,
	`reminder_at` integer,
	`repeat` text DEFAULT 'NONE' NOT NULL,
	`attached_notes` text DEFAULT '',
	`linked_note_id` text,
	`status` text DEFAULT 'TODO' NOT NULL,
	`date` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`series_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
