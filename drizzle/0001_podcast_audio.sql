ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_api_key_encrypted" text;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "podcast_audio_engine" varchar(32) DEFAULT 'speechSynthesis' NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_host_voice" varchar(80) DEFAULT '21m00Tcm4TlvDq8ikWAM' NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "elevenlabs_guest_voice" varchar(80) DEFAULT 'pNInz6obpgDQGcFmaJgB' NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "kokoclone_endpoint" varchar(255) DEFAULT 'http://127.0.0.1:7860' NOT NULL;
