CREATE TYPE "public"."sentence_source" AS ENUM('bank_builder', 'mixed_generated');--> statement-breakpoint
CREATE TABLE "gemini_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"day" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "gemini_usage_model_day_unique" UNIQUE("model","day")
);
--> statement-breakpoint
CREATE TABLE "sentence_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"sentence_id" integer NOT NULL,
	"vocab_item_id" integer NOT NULL,
	CONSTRAINT "sentence_words_sentence_item_unique" UNIQUE("sentence_id","vocab_item_id")
);
--> statement-breakpoint
CREATE TABLE "sentences" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer,
	"source" "sentence_source" NOT NULL,
	"spanish" text NOT NULL,
	"english" text NOT NULL,
	"focus_vocab_item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD COLUMN "sentence_id" integer;--> statement-breakpoint
ALTER TABLE "sentence_words" ADD CONSTRAINT "sentence_words_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_words" ADD CONSTRAINT "sentence_words_vocab_item_id_vocab_items_id_fk" FOREIGN KEY ("vocab_item_id") REFERENCES "public"."vocab_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_focus_vocab_item_id_vocab_items_id_fk" FOREIGN KEY ("focus_vocab_item_id") REFERENCES "public"."vocab_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sentence_words_vocab_item_id_idx" ON "sentence_words" USING btree ("vocab_item_id");--> statement-breakpoint
CREATE INDEX "sentences_topic_id_idx" ON "sentences" USING btree ("topic_id");--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_attempts_sentence_id_idx" ON "exercise_attempts" USING btree ("sentence_id");