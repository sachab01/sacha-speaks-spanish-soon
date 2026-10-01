ALTER TABLE "exercise_attempts" ADD COLUMN "sentence_model" text;--> statement-breakpoint
ALTER TABLE "sentences" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "sentences" ADD COLUMN "review_model" text;