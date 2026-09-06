import { and, asc, desc, eq } from "drizzle-orm";

import { ConflictError, NotFoundError } from "../errors";
import { ratingFromPronunciation, ratingFromTranslationCloseness, reviewSrsCard } from "../fsrs";
import { gradePronunciation } from "../gemini/agents/pronunciationCoach";
import { generatePracticeSentence } from "../gemini/agents/sentenceGenerator";
import { gradeTranslation, type TranslationDirection } from "../gemini/agents/translationGrader";
import { findUncoveredTokens } from "../gemini/vocab";
import { db } from "./client";
import { bankItems, exerciseAttempts, srsState } from "./schema";

export type ExerciseType = "writing" | "speaking" | "listening";

const RECENT_SENTENCE_LIMIT = 3;

async function getCoveredVocab(topicId: number) {
  return db
    .select({ spanish: bankItems.spanish, english: bankItems.english })
    .from(bankItems)
    .where(eq(bankItems.topicId, topicId));
}

/**
 * Picks the earliest-due (bankItem, exerciseType) for this topic, generates a
 * fresh practice sentence around it, and records a pending attempt. Returns
 * the full attempt row; callers redact whichever side is the "answer" for
 * their exercise type before sending it to the client.
 */
export async function getNextPracticeItem(topicId: number, exerciseType: ExerciseType) {
  const [dueRow] = await db
    .select({
      bankItemId: bankItems.id,
      spanish: bankItems.spanish,
      english: bankItems.english,
    })
    .from(srsState)
    .innerJoin(bankItems, eq(srsState.bankItemId, bankItems.id))
    .where(and(eq(bankItems.topicId, topicId), eq(srsState.exerciseType, exerciseType)))
    .orderBy(asc(srsState.dueAt))
    .limit(1);

  if (!dueRow) {
    throw new NotFoundError("This topic has no bank items to practice yet.");
  }

  const coveredVocab = await getCoveredVocab(topicId);
  const focusItem = { spanish: dueRow.spanish, english: dueRow.english };

  const recentAttempts = await db
    .select({ generatedSpanish: exerciseAttempts.generatedSpanish })
    .from(exerciseAttempts)
    .where(and(eq(exerciseAttempts.bankItemId, dueRow.bankItemId), eq(exerciseAttempts.status, "graded")))
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
      bankItemId: dueRow.bankItemId,
      status: "pending",
      generatedSpanish: sentence.spanish,
      generatedEnglish: sentence.english,
      wordsUsed: sentence.wordsUsed,
    })
    .returning();

  return attempt;
}

async function loadPendingAttempt(attemptId: string) {
  const [attempt] = await db.select().from(exerciseAttempts).where(eq(exerciseAttempts.id, attemptId));
  if (!attempt) throw new NotFoundError("Practice attempt not found.");
  if (attempt.status === "graded") throw new ConflictError("This attempt has already been graded.");
  return attempt;
}

async function applyReview(bankItemId: number, exerciseType: ExerciseType, rating: Parameters<typeof reviewSrsCard>[1]) {
  const [srsRow] = await db
    .select()
    .from(srsState)
    .where(and(eq(srsState.bankItemId, bankItemId), eq(srsState.exerciseType, exerciseType)));

  const { card, isCorrect } = reviewSrsCard(srsRow, rating);
  await db.update(srsState).set(card).where(eq(srsState.id, srsRow.id));
  return isCorrect;
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
  const grade = await gradeTranslation({ expected, userAnswer: userAnswerText, direction });
  const rating = ratingFromTranslationCloseness(grade.closeness);
  const isCorrect = await applyReview(attempt.bankItemId, attempt.exerciseType as ExerciseType, rating);

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
  const isCorrect = await applyReview(attempt.bankItemId, attempt.exerciseType as ExerciseType, rating);

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
