import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";

import type { TranslationGradeResult } from "./gemini/agents/translationGrader";
import type { PronunciationCoachResult } from "./gemini/agents/pronunciationCoach";

export type FsrsRatingLabel = "again" | "hard" | "good" | "easy";
export type SrsCardState = "new" | "learning" | "review" | "relearning";

/** Mirrors one `srsState` row's FSRS-relevant columns, decoupled from the Drizzle row shape. */
export type SrsCardData = {
  dueAt: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: SrsCardState;
  lastReviewAt: Date | null;
};

const scheduler = fsrs();

const STATE_TO_DB: Record<State, SrsCardState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const DB_TO_STATE: Record<SrsCardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const LABEL_TO_RATING: Record<FsrsRatingLabel, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toFsrsCard(data: SrsCardData): Card {
  return {
    due: data.dueAt,
    stability: data.stability,
    difficulty: data.difficulty,
    elapsed_days: data.elapsedDays,
    scheduled_days: data.scheduledDays,
    learning_steps: data.learningSteps,
    reps: data.reps,
    lapses: data.lapses,
    state: DB_TO_STATE[data.state],
    last_review: data.lastReviewAt ?? undefined,
  };
}

function fromFsrsCard(card: Card): SrsCardData {
  return {
    dueAt: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_DB[card.state],
    lastReviewAt: card.last_review ?? null,
  };
}

/** A brand-new bank item's initial (bankItem, exerciseType) SRS state — due immediately. */
export function createInitialSrsCard(now: Date = new Date()): SrsCardData {
  return fromFsrsCard(createEmptyCard(now));
}

/** Applies one review to a card, returning the updated card and whether it counts as "correct". */
export function reviewSrsCard(
  card: SrsCardData,
  rating: FsrsRatingLabel,
  now: Date = new Date(),
): { card: SrsCardData; isCorrect: boolean } {
  const { card: updatedCard } = scheduler.next(toFsrsCard(card), now, LABEL_TO_RATING[rating]);
  return { card: fromFsrsCard(updatedCard), isCorrect: rating !== "again" };
}

/**
 * exact/synonym answers count as an easy recall; a wrong word (but otherwise on-task)
 * still counts as a recall, just a harder one, since the learner engaged with the
 * right concept. Wrong or unattempted answers reset progress via "again".
 */
export function ratingFromTranslationCloseness(closeness: TranslationGradeResult["closeness"]): FsrsRatingLabel {
  switch (closeness) {
    case "exact":
      return "easy";
    case "minor_variation":
      return "good";
    case "wrong_word":
      return "hard";
    case "wrong":
    case "unattempted":
      return "again";
  }
}

/**
 * Saying the wrong words entirely is always a failed recall regardless of how
 * clearly it was pronounced — SM-2/FSRS's "successful recall" should require
 * having actually produced the target sentence, not just being easy to say.
 */
export function ratingFromPronunciation(result: PronunciationCoachResult): FsrsRatingLabel {
  if (!result.targetSpokenCorrectly) return "again";
  if (result.pronunciationScore >= 90) return "easy";
  if (result.pronunciationScore >= 75) return "good";
  return "hard";
}
