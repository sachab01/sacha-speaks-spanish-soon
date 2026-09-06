CREATE TYPE "public"."attempt_status" AS ENUM('pending', 'graded');--> statement-breakpoint
CREATE TYPE "public"."bank_item_source" AS ENUM('bank_builder', 'tutor_qna');--> statement-breakpoint
CREATE TYPE "public"."bank_item_type" AS ENUM('word', 'sentence');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('writing', 'speaking', 'listening');--> statement-breakpoint
CREATE TYPE "public"."fsrs_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."srs_card_state" AS ENUM('new', 'learning', 'review', 'relearning');--> statement-breakpoint
CREATE TABLE "bank_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"item_type" "bank_item_type" NOT NULL,
	"spanish" text NOT NULL,
	"english" text NOT NULL,
	"part_of_speech" text,
	"source" "bank_item_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_items_topic_spanish_unique" UNIQUE("topic_id","spanish")
);
--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" integer NOT NULL,
	"exercise_type" "exercise_type" NOT NULL,
	"bank_item_id" integer NOT NULL,
	"status" "attempt_status" DEFAULT 'pending' NOT NULL,
	"generated_spanish" text NOT NULL,
	"generated_english" text NOT NULL,
	"words_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_answer_text" text,
	"user_audio_transcript" text,
	"is_correct" boolean,
	"score" integer,
	"feedback_en" text,
	"fsrs_rating" "fsrs_rating",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "qna_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"attempt_id" uuid,
	"question_text" text,
	"question_audio_transcript" text,
	"answer_text" text NOT NULL,
	"on_topic" boolean NOT NULL,
	"new_vocab_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_item_id" integer NOT NULL,
	"exercise_type" "exercise_type" NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0 NOT NULL,
	"elapsed_days" real DEFAULT 0 NOT NULL,
	"scheduled_days" real DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" "srs_card_state" DEFAULT 'new' NOT NULL,
	"last_review_at" timestamp with time zone,
	CONSTRAINT "srs_state_item_exercise_unique" UNIQUE("bank_item_id","exercise_type")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_items" ADD CONSTRAINT "bank_items_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_bank_item_id_bank_items_id_fk" FOREIGN KEY ("bank_item_id") REFERENCES "public"."bank_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qna_log" ADD CONSTRAINT "qna_log_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qna_log" ADD CONSTRAINT "qna_log_attempt_id_exercise_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exercise_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_state" ADD CONSTRAINT "srs_state_bank_item_id_bank_items_id_fk" FOREIGN KEY ("bank_item_id") REFERENCES "public"."bank_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_items_topic_id_idx" ON "bank_items" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "exercise_attempts_topic_id_idx" ON "exercise_attempts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "exercise_attempts_bank_item_id_idx" ON "exercise_attempts" USING btree ("bank_item_id");--> statement-breakpoint
CREATE INDEX "qna_log_topic_id_idx" ON "qna_log" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "srs_state_exercise_due_idx" ON "srs_state" USING btree ("exercise_type","due_at");