import { and, asc, desc, eq } from "drizzle-orm";

import { ConflictError, NotFoundError } from "../errors";
import { ratingFromPronunciation, ratingFromTranslationCloseness, reviewSrsCard } from "../fsrs";
import { gradePronunciation } from "../gemini/agents/pronunciationCoach";
import { generatePracticeSentence } from "../gemini/agents/sentenceGenerator";
import { gradeTranslation, type TranslationDirection, type TranslationGradeResult } from "../gemini/agents/translationGrader";
import { findUncoveredTokens } from "../gemini/vocab";
import { db } from "./client";
import { exerciseAttempts, srsState, topicVocab, vocabItems } from "./schema";

export const EXERCISE_TYPES = ["writing", "speaking", "listening"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const RECENT_SENTENCE_LIMIT = 3;

/** A topic's own vocabulary (via its topicVocab links). */
export async function getCoveredVocab(topicId: number) {
  return db
    .select({ spanish: vocabItems.spanish, english: vocabItems.english })
    .from(topicVocab)
    .innerJoin(vocabItems, eq(vocabItems.id, topicVocab.vocabItemId))
    .where(eq(topicVocab.topicId, topicId));
}

/** Every vocab item globally — the whitelist for Mixed Review's cross-topic sentences. */
export async function getAllCoveredVocab() {
  return db.select({ spanish: vocabItems.spanish, english: vocabItems.english }).from(vocabItems);
}

type DueItem = { vocabItemId: number; spanish: string; english: string };

/**
 * Generates a fresh practice sentence around the given due item and records
 * a pending attempt. Shared by the per-topic and Mixed Review "next" paths —
 * they differ only in how the due item and covered-vocab whitelist are
 * scoped, not in how the sentence/attempt gets built. `topicId` is null for
 * Mixed Review attempts, which aren't scoped to one topic.
 */
async function buildAttemptForDueItem(params: {
  exerciseType: ExerciseType;
  topicId: number | null;
  dueRow: DueItem;
  coveredVocab: { spanish: string; english: string }[];
}) {
  const { exerciseType, topicId, dueRow, coveredVocab } = params;
  const focusItem = { spanish: dueRow.spanish, english: dueRow.english };

  const recentAttempts = await db
    .select({ generatedSpanish: exerciseAttempts.generatedSpanish })
    .from(exerciseAttempts)
    .where(and(eq(exerciseAttempts.vocabItemId, dueRow.vocabItemId), eq(exerciseAttempts.status, "graded")))
    .orderBy(desc(exerciseAttempts.createdAt))
    .limit(RECENT_SENTENCE_LIMIT);

  let sentence = await generatePracticeSentence({
    focusItem,
    coveredVocab,
    recentSentences: recentAttempts.map((a) => a.generatedSpanish),
  });

  if (findUncoveredTokens(sentence.spanish, coveredVocab).length > 0) {
    try {
      const retry = await generatePracticeSentence({
        focusItem,
        coveredVocab,
        recentSentences: [...recentAttempts.map((a) => a.generatedSpanish), sentence.spanish],
      });
      sentence = findUncoveredTokens(retry.spanish, coveredVocab).length > 0
        ? { spanish: focusItem.spanish, english: focusItem.english, wordsUsed: [focusItem.spanish] }
        : retry;
    } catch {
      sentence = { spanish: focusItem.spanish, english: focusItem.english, wordsUsed: [focusItem.spanish] };
    }
  }

  const [attempt] = await db
    .insert(exerciseAttempts)
    .values({
      topicId,
      exerciseType,
      vocabItemId: dueRow.vocabItemId,
      status: "pending",
      generatedSpanish: sentence.spanish,
      generatedEnglish: sentence.english,
      wordsUsed: sentence.wordsUsed,
    })
    .returning();

  return attempt;
}

/**
 * Picks the earliest-due (vocabItem, exerciseType) linked to this topic,
 * generates a fresh practice sentence around it, and records a pending
 * attempt. Because SRS progress is shared globally per vocab item, an item
 * also used in another topic reflects progress from practicing it there too.
 */
export async function getNextPracticeItem(topicId: number, exerciseType: ExerciseType) {
  const [dueRow] = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
    })
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .innerJoin(topicVocab, eq(topicVocab.vocabItemId, vocabItems.id))
    .where(and(eq(topicVocab.topicId, topicId), eq(srsState.exerciseType, exerciseType)))
    .orderBy(asc(srsState.dueAt))
    .limit(1);

  if (!dueRow) {
    throw new NotFoundError("This topic has no bank items to practice yet.");
  }

  const coveredVocab = await getCoveredVocab(topicId);
  return buildAttemptForDueItem({ exerciseType, topicId, dueRow, coveredVocab });
}

/**
 * Mixed Review's "next": the earliest-due item across ALL topics, with the
 * sentence generator free to combine vocabulary from every topic.
 */
export async function getNextMixedPracticeItem(exerciseType: ExerciseType) {
  const [dueRow] = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
    })
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .where(eq(srsState.exerciseType, exerciseType))
    .orderBy(asc(srsState.dueAt))
    .limit(1);

  if (!dueRow) {
    throw new NotFoundError("No topics have any bank items to practice yet.");
  }

  const coveredVocab = await getAllCoveredVocab();
  return buildAttemptForDueItem({ exerciseType, topicId: null, dueRow, coveredVocab });
}

async function loadPendingAttempt(attemptId: string) {
  const [attempt] = await db.select().from(exerciseAttempts).where(eq(exerciseAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Practice attempt not found.");
  if (attempt.status === "graded") throw new ConflictError("This attempt has already been graded.");
  return attempt;
}

async function applyReview(vocabItemId: number, exerciseType: ExerciseType, rating: Parameters<typeof reviewSrsCard>[1]) {
  const [srsRow] = await db
    .select()
    .from(srsState)
    .where(and(eq(srsState.vocabItemId, vocabItemId), eq(srsState.exerciseType, exerciseType)));

  const { card, isCorrect } = reviewSrsCard(srsRow, rating);
  await db.update(srsState).set(card).where(eq(srsState.id, srsRow.id));
  return isCorrect;
}

/** Strips accents, case, and punctuation so a verbatim (if imperfect) match can skip the Gemini call. */
function normalizeForExactMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'()«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Grades a writing (en_to_es) or listening (es_to_en) attempt. */
export async function submitTranslationAttempt(params: {
  attemptId: string;
  userAnswerText: string;
  direction: TranslationDirection;
}) {
  const { attemptId, userAnswerText, direction } = params;
  const attempt = await loadPendingAttempt(attemptId);

  const expected = direction === "en_to_es" ? attempt.generatedSpanish : attempt.generatedEnglish;

  // A verbatim match (modulo accents/case/punctuation) is unambiguously correct —
  // skip the Gemini call entirely. Anything else needs Gemini's judgment, since a
  // real translation can be a valid synonym/rephrasing that never matches exactly.
  const grade: TranslationGradeResult =
    normalizeForExactMatch(userAnswerText) === normalizeForExactMatch(expected)
      ? { closeness: "exact", feedback: "Correct!" }
      : await gradeTranslation({ expected, userAnswer: userAnswerText, direction });

  const rating = ratingFromTranslationCloseness(grade.closeness);
  const isCorrect = await applyReview(attempt.vocabItemId, attempt.exerciseType as ExerciseType, rating);

  await db
    .update(exerciseAttempts)
    .set({
      status: "graded",
      userAnswerText,
      isCorrect,
      feedbackEn: grade.feedback,
      fsrsRating: rating,
      gradedAt: new Date(),
    })
    .where(eq(exerciseAttempts.id, attemptId));

  return {
    correct: isCorrect,
    feedbackEn: grade.feedback,
    correctAnswerEs: attempt.generatedSpanish,
    correctAnswerEn: attempt.generatedEnglish,
  };
}

/** Grades a speaking attempt from recorded mic audio. */
export async function submitSpeakingAttempt(params: { attemptId: string; audioBytes: Buffer; mimeType: string }) {
  const { attemptId, audioBytes, mimeType } = params;
  const attempt = await loadPendingAttempt(attemptId);

  const result = await gradePronunciation({ expectedEs: attempt.generatedSpanish, audioBytes, mimeType });
  const rating = ratingFromPronunciation(result);
  const isCorrect = await applyReview(attempt.vocabItemId, attempt.exerciseType as ExerciseType, rating);

  await db
    .update(exerciseAttempts)
    .set({
      status: "graded",
      userAudioTranscript: result.transcript,
      isCorrect,
      score: result.pronunciationScore,
      feedbackEn: result.feedbackEnglish,
      fsrsRating: rating,
      gradedAt: new Date(),
    })
    .where(eq(exerciseAttempts.id, attemptId));

  return {
    correct: isCorrect,
    feedbackEn: result.feedbackEnglish,
    correctAnswerEs: attempt.generatedSpanish,
    transcript: result.transcript,
    pronunciationScore: result.pronunciationScore,
  };
}
