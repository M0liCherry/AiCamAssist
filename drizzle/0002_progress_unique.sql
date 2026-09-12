DELETE FROM "flashcard_progress" a USING "flashcard_progress" b WHERE a."id" > b."id" AND a."asset_id" = b."asset_id" AND a."card_index" = b."card_index";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "progress_asset_card_idx" ON "flashcard_progress" USING btree ("asset_id","card_index");
