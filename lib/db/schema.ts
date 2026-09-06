import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const bankItemTypeEnum = pgEnum("bank_item_type", ["word", "sentence"]);
export const bankItemSourceEnum = pgEnum("bank_item_source", ["bank_builder", "tutor_qna"]);
export const exerciseTypeEnum = pgEnum("exercise_type", ["writing", "speaking", "listening"]);
export const srsCardStateEnum = pgEnum("srs_card_state", ["new", "learning", "review", "relearning"]);
export const fsrsRatingEnum = pgEnum("fsrs_rating", ["again", "hard", "good", "easy"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["pending", "graded"]);

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bankItems = pgTable(
  "bank_items",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    itemType: bankItemTypeEnum("item_type").notNull(),
    spanish: text("spanish").notNull(),
    english: text("english").notNull(),
    partOfSpeech: text("part_of_speech"),
    source: bankItemSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("bank_items_topic_spanish_unique").on(table.topicId, table.spanish),
    index("bank_items_topic_id_idx").on(table.topicId),
  ],
);

export const srsState = pgTable(
  "srs_state",
  {
    id: serial("id").primaryKey(),
    bankItemId: integer("bank_item_id")
      .notNull()
      .references(() => bankItems.id, { onDelete: "cascade" }),
    exerciseType: exerciseTypeEnum("exercise_type").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: real("elapsed_days").notNull().default(0),
    scheduledDays: real("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: srsCardStateEnum("state").notNull().default("new"),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
  },
  (table) => [
    unique("srs_state_item_exercise_unique").on(table.bankItemId, table.exerciseType),
    index("srs_state_exercise_due_idx").on(table.exerciseType, table.dueAt),
  ],
);

export const exerciseAttempts = pgTable(
  "exercise_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    exerciseType: exerciseTypeEnum("exercise_type").notNull(),
    bankItemId: integer("bank_item_id")
      .notNull()
      .references(() => bankItems.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("pending"),
    generatedSpanish: text("generated_spanish").notNull(),
    generatedEnglish: text("generated_english").notNull(),
    wordsUsed: jsonb("words_used").$type<string[]>().notNull().default([]),
    userAnswerText: text("user_answer_text"),
    userAudioTranscript: text("user_audio_transcript"),
    isCorrect: boolean("is_correct"),
    score: integer("score"),
    feedbackEn: text("feedback_en"),
    fsrsRating: fsrsRatingEnum("fsrs_rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
  },
  (table) => [
    index("exercise_attempts_topic_id_idx").on(table.topicId),
    index("exercise_attempts_bank_item_id_idx").on(table.bankItemId),
  ],
);

export const qnaLog = pgTable(
  "qna_log",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => exerciseAttempts.id, { onDelete: "cascade" }),
    questionText: text("question_text"),
    questionAudioTranscript: text("question_audio_transcript"),
    answerText: text("answer_text").notNull(),
    onTopic: boolean("on_topic").notNull(),
    newVocabJson: jsonb("new_vocab_json").$type<
      { spanish: string; english: string; itemType: "word" | "sentence"; added: boolean }[]
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("qna_log_topic_id_idx").on(table.topicId)],
);
