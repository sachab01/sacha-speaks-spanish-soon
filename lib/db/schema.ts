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

export const vocabItemTypeEnum = pgEnum("vocab_item_type", ["word", "sentence"]);
export const vocabItemSourceEnum = pgEnum("vocab_item_source", ["bank_builder", "tutor_qna", "core_vocab"]);
export const exerciseTypeEnum = pgEnum("exercise_type", ["writing", "speaking", "listening"]);
export const srsCardStateEnum = pgEnum("srs_card_state", ["new", "learning", "review", "relearning"]);
export const fsrsRatingEnum = pgEnum("fsrs_rating", ["again", "hard", "good", "easy"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["pending", "graded"]);

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Vocabulary is global, not per-topic: the same Spanish word/phrase used in
 * multiple topics is ONE row here (and one shared SRS progress), linked to
 * whichever topics use it via topicVocab. Only exact-string duplicates are
 * merged this way — different grammatical forms of a word (plural, "yo" vs
 * "nosotros" vs "ella" conjugations, etc.) are intentionally separate rows,
 * since a learner can know one form without knowing another.
 */
export const vocabItems = pgTable(
  "vocab_items",
  {
    id: serial("id").primaryKey(),
    itemType: vocabItemTypeEnum("item_type").notNull(),
    spanish: text("spanish").notNull(),
    english: text("english").notNull(),
    partOfSpeech: text("part_of_speech"),
    source: vocabItemSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("vocab_items_spanish_unique").on(table.spanish)],
);

/** Which topics a vocab item belongs to (many-to-many). */
export const topicVocab = pgTable(
  "topic_vocab",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    vocabItemId: integer("vocab_item_id")
      .notNull()
      .references(() => vocabItems.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("topic_vocab_topic_item_unique").on(table.topicId, table.vocabItemId),
    index("topic_vocab_vocab_item_id_idx").on(table.vocabItemId),
  ],
);

/** One shared SRS card per (vocabItem, exerciseType) — progress is not duplicated per topic. */
export const srsState = pgTable(
  "srs_state",
  {
    id: serial("id").primaryKey(),
    vocabItemId: integer("vocab_item_id")
      .notNull()
      .references(() => vocabItems.id, { onDelete: "cascade" }),
    exerciseType: exerciseTypeEnum("exercise_type").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: real("elapsed_days").notNull().default(0),
    scheduledDays: real("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: srsCardStateEnum("state").notNull().default("new"),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    /** A direct 0-100 mastery meter, separate from FSRS's own scheduling fields above — see lib/fsrs.ts. */
    masteryScore: integer("mastery_score").notNull().default(50),
  },
  (table) => [
    unique("srs_state_item_exercise_unique").on(table.vocabItemId, table.exerciseType),
    index("srs_state_exercise_due_idx").on(table.exerciseType, table.dueAt),
  ],
);

export const exerciseAttempts = pgTable(
  "exercise_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null for Mixed Review attempts, which aren't scoped to one topic.
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    exerciseType: exerciseTypeEnum("exercise_type").notNull(),
    vocabItemId: integer("vocab_item_id")
      .notNull()
      .references(() => vocabItems.id, { onDelete: "cascade" }),
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
    index("exercise_attempts_vocab_item_id_idx").on(table.vocabItemId),
  ],
);

export const qnaLog = pgTable(
  "qna_log",
  {
    id: serial("id").primaryKey(),
    // Null for Mixed Review Q&A, which isn't scoped to one topic.
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "cascade" }),
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
