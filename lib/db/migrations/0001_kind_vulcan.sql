ALTER TYPE "public"."vocab_item_source" ADD VALUE 'core_vocab';--> statement-breakpoint
ALTER TABLE "srs_state" ADD COLUMN "mastery_score" integer DEFAULT 50 NOT NULL;