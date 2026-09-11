CREATE TABLE "chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_type" varchar(12) NOT NULL,
	"scope_id" integer NOT NULL,
	"role" varchar(12) NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"embedding_model" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "flashcard_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"card_index" integer NOT NULL,
	"status" varchar(12) DEFAULT 'new' NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_type" varchar(12) NOT NULL,
	"scope_id" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"source_note_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"source_type" varchar(32) DEFAULT 'document' NOT NULL,
	"source_label" varchar(600),
	"status" varchar(24) DEFAULT 'ready' NOT NULL,
	"index_state" varchar(24) DEFAULT 'none' NOT NULL,
	"error_message" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"topic_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(32) DEFAULT 'none' NOT NULL,
	"model" varchar(160) DEFAULT '' NOT NULL,
	"embedding_model" varchar(160) DEFAULT '' NOT NULL,
	"endpoint" varchar(400) DEFAULT '' NOT NULL,
	"api_key_encrypted" text,
	"stt_model" varchar(160) DEFAULT 'Xenova/whisper-base' NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"privacy_consent_at" timestamp with time zone,
	"provider_consent_at" timestamp with time zone,
	"diagnostics_opt_in" boolean DEFAULT false NOT NULL,
	"theme" varchar(12) DEFAULT 'dark' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_asset_id_generated_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."generated_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_asset_id_generated_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."generated_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapters_subject_idx" ON "chapters" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "chat_scope_idx" ON "chat_messages" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "chunks_note_idx" ON "chunks" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "chunks_chapter_idx" ON "chunks" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chunks_subject_idx" ON "chunks" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "progress_asset_idx" ON "flashcard_progress" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_scope_idx" ON "generated_assets" USING btree ("scope_type","scope_id","kind");--> statement-breakpoint
CREATE INDEX "notes_chapter_idx" ON "notes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "attempts_asset_idx" ON "quiz_attempts" USING btree ("asset_id");