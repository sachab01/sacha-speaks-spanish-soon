import { and, asc, desc, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import { ConflictError, NotFoundError } from "../errors";
import { applyMasteryDelta, ratingFromPronunciation, ratingFromWordVerdict, reviewSrsCard } from "../fsrs";
import { gradePronunciation } from "../gemini/agents/pronunciationCoach";
import { generatePracticeSentence } from "../gemini/agents/sentenceGenerator";
import { gradeTranslation, hadMistakes, type TranslationDirection, type WordVerdict } from "../gemini/agents/translationGrader";
import { findUncoveredTokens } from "../gemini/vocab";
import { alignTranscriptToExpected } from "../wordDiff";
import { db } from "./client";
import { exerciseAttempts, srsState, topicVocab, vocabItems } from "./schema";

export const EXERCISE_TYPES = ["writing", "speaking", "listening"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const RECENT_SENTENCE_LIMIT = 3;

/** The shared, always-available glue vocabulary (see lib/db/coreVocab.ts) — not owned by any topic. */
async function getCoreVocab() {
  return db
    .select({ spanish: vocabItems.spanish, english: vocabItems.english })
    .from(vocabItems)
    .where(eq(vocabItems.source, "core_vocab"));
}

/** A topic's own vocabulary (via its topicVocab links), plus the shared core vocabulary. */
export async function getCoveredVocab(topicId: number) {
  const [topicRows, coreRows] = await Promise.all([
    db
      .select({ spanish: vocabItems.spanish, english: vocabItems.english })
      .from(topicVocab)
      .innerJoin(vocabItems, eq(vocabItems.id, topicVocab.vocabItemId))
      // Numbers are excluded here so they don't get pulled in as filler for
      // other topics' sentences — they're only usable as sentence content in
      // Mixed Review (getAllCoveredVocab, below), and never sentence-wrapped
      // at all when a number is itself the focus item (see buildAttemptForDueItem).
      .where(and(eq(topicVocab.topicId, topicId), or(isNull(vocabItems.partOfSpeech), ne(vocabItems.partOfSpeech, "number")))),
    getCoreVocab(),
  ]);

  const bySpanish = new Map(topicRows.map((r) => [r.spanish.toLowerCase(), r]));
  for (const row of coreRows) {
    if (!bySpanish.has(row.spanish.toLowerCase())) bySpanish.set(row.spanish.toLowerCase(), row);
  }
  return Array.from(bySpanish.values());
}

/** Every vocab item globally (already includes core vocabulary) — the whitelist for Mixed Review's cross-topic sentences. */
export async function getAllCoveredVocab() {
  return db.select({ spanish: vocabItems.spanish, english: vocabItems.english }).from(vocabItems);
}

/** Per-word mastery for one exercise type, for ranking which covered words the learner is weakest on. */
async function getMasteryScoresByExerciseType(exerciseType: ExerciseType): Promise<Map<string, number>> {
  const rows = await db
    .select({ spanish: vocabItems.spanish, masteryScore: srsState.masteryScore })
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .where(eq(srsState.exerciseType, exerciseType));
  return new Map(rows.map((r) => [r.spanish.toLowerCase(), r.masteryScore]));
}

const PREFERRED_WORD_COUNT = 5;

type DueItem = { vocabItemId: number; spanish: string; english: string; partOfSpeech: string | null };

/**
 * How to pick the next item within a practice queue:
 * - "due": normal spaced-repetition order (earliest due date first).
 * - "weakest": highest lapse rate first — words you get wrong most often.
 * - "stale": longest since last reviewed first (never-reviewed counts as most stale).
 */
export const PRACTICE_FOCUSES = ["due", "weakest", "stale"] as const;
export type PracticeFocus = (typeof PRACTICE_FOCUSES)[number];

function focusOrderBy(focus: PracticeFocus): SQL[] {
  switch (focus) {
    case "weakest":
      return [desc(sql`${srsState.lapses}::float / greatest(${srsState.reps}, 1)`), asc(srsState.dueAt)];
    case "stale":
      return [asc(sql`coalesce(${srsState.lastReviewAt}, to_timestamp(0))`), asc(srsState.dueAt)];
    case "due":
    default:
      return [asc(srsState.dueAt)];
  }
}

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

  let sentence: { spanish: string; english: string; wordsUsed: string[] } | null = null;

  if (dueRow.partOfSpeech === "number") {
    // Numbers are drilled directly, never wrapped in a generated sentence —
    // they're still fair game as filler *within* other words' sentences during
    // Mixed Review (see getAllCoveredVocab), just never the thing being
    // sentence-built around.
    sentence = { spanish: focusItem.spanish, english: focusItem.english, wordsUsed: [focusItem.spanish] };
  } else {
    const [recentAttempts, masteryByWord] = await Promise.all([
      db
        .select({ generatedSpanish: exerciseAttempts.generatedSpanish })
        .from(exerciseAttempts)
        .where(and(eq(exerciseAttempts.vocabItemId, dueRow.vocabItemId), eq(exerciseAttempts.status, "graded")))
        .orderBy(desc(exerciseAttempts.createdAt))
        .limit(RECENT_SENTENCE_LIMIT),
      getMasteryScoresByExerciseType(exerciseType),
    ]);

    // Bias the sentence generator's *filler* word choice (not the mandatory focus
    // word, which is already the weakest-due item) toward whichever other covered
    // words the learner currently knows least well.
    const preferredWords = coveredVocab
      .filter((w) => w.spanish.toLowerCase() !== focusItem.spanish.toLowerCase())
      .slice()
      .sort((a, b) => (masteryByWord.get(a.spanish.toLowerCase()) ?? 50) - (masteryByWord.get(b.spanish.toLowerCase()) ?? 50))
      .slice(0, PREFERRED_WORD_COUNT);

    try {
      sentence = await generatePracticeSentence({
        focusItem,
        coveredVocab,
        preferredWords,
        recentSentences: recentAttempts.map((a) => a.generatedSpanish),
      });
    } catch {
      sentence = null;
    }

    if (!sentence || findUncoveredTokens(sentence.spanish, coveredVocab).length > 0) {
      const avoidList = sentence
        ? [...recentAttempts.map((a) => a.generatedSpanish), sentence.spanish]
        : recentAttempts.map((a) => a.generatedSpanish);
      try {
        // Accept this retry's sentence even if the heuristic still flags a token —
        // findUncoveredTokens doesn't lemmatize, so it can misfire on inflected
        // forms of genuinely-covered words. A full sentence with a possible minor
        // false positive is far better UX than collapsing to a bare single word.
        sentence = await generatePracticeSentence({ focusItem, coveredVocab, preferredWords, recentSentences: avoidList });
      } catch {
        // Real generation failure on both attempts (not just the heuristic check) —
        // only now fall back to a bare single-word prompt, as a genuine last resort.
        if (!sentence) {
          sentence = { spanish: focusItem.spanish, english: focusItem.english, wordsUsed: [focusItem.spanish] };
        }
      }
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
export async function getNextPracticeItem(
  topicId: number,
  exerciseType: ExerciseType,
  focus: PracticeFocus = "due",
) {
  const [dueRow] = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
      partOfSpeech: vocabItems.partOfSpeech,
    })
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .innerJoin(topicVocab, eq(topicVocab.vocabItemId, vocabItems.id))
    .where(and(eq(topicVocab.topicId, topicId), eq(srsState.exerciseType, exerciseType)))
    .orderBy(...focusOrderBy(focus))
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
export async function getNextMixedPracticeItem(exerciseType: ExerciseType, focus: PracticeFocus = "due") {
  const [dueRow] = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
      partOfSpeech: vocabItems.partOfSpeech,
    })
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .where(and(eq(srsState.exerciseType, exerciseType), ne(vocabItems.source, "core_vocab")))
    .orderBy(...focusOrderBy(focus))
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
  const masteryScore = applyMasteryDelta(srsRow.masteryScore, rating);
  await db.update(srsState).set({ ...card, masteryScore }).where(eq(srsState.id, srsRow.id));
  return isCorrect;
}

/**
 * Normalizes for matching a grader-echoed vocab word back to its stored vocabItem —
 * the model doesn't always reproduce trailing punctuation exactly (e.g. echoing
 * "No entiendo" for a stored "No entiendo."), so comparison ignores punctuation
 * and whitespace differences. Accents are kept, since they distinguish real words
 * (e.g. "el"/"él", "tu"/"tú").
 */
function normalizeForVocabMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'()«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lookup of vocabItem ids by Spanish spelling (punctuation/whitespace-insensitive) — resolves a grader's echoed-back vocab words to real ids. */
async function resolveVocabItemIds(spanishForms: string[]): Promise<Map<string, number>> {
  if (spanishForms.length === 0) return new Map();

  const punctPattern = String.raw`[¿?¡!.,;:'"()«»]`;
  // A literal backslash (e.g. in '\s+') doesn't survive being passed as a bound
  // parameter through the Neon HTTP driver — it arrives stripped, silently
  // turning "\s+" into "s+" and corrupting any word containing a letter 's'.
  // The POSIX bracket class below needs no backslash, so it's safe to bind.
  const wsPattern = "[[:space:]]+";
  const conditions = spanishForms.map(
    (s) => sql`lower(regexp_replace(regexp_replace(${vocabItems.spanish}, ${punctPattern}, '', 'g'), ${wsPattern}, ' ', 'g')) = ${normalizeForVocabMatch(s)}`,
  );
  const rows = await db
    .select({ id: vocabItems.id, spanish: vocabItems.spanish })
    .from(vocabItems)
    .where(or(...conditions));

  return new Map(rows.map((r) => [normalizeForVocabMatch(r.spanish), r.id]));
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
  const wordsUsed = attempt.wordsUsed;

  // A blank answer or a verbatim match (modulo accents/case/punctuation) is
  // unambiguously gradable without the model's judgment — skip the grader call
  // entirely for either. Anything else needs real judgment, since a genuine
  // translation can be a valid synonym/rephrasing that never matches exactly.
  let words: WordVerdict[];
  let feedback: string;
  if (userAnswerText.trim() === "") {
    words = wordsUsed.map((vocabWord) => ({
      vocabWord,
      sentenceText: vocabWord,
      userSaid: null,
      verdict: "missing" as const,
      note: null,
    }));
    feedback = "You didn't write anything — here's the correct answer.";
  } else if (normalizeForExactMatch(userAnswerText) === normalizeForExactMatch(expected)) {
    words = wordsUsed.map((vocabWord) => ({
      vocabWord,
      sentenceText: vocabWord,
      userSaid: vocabWord,
      verdict: "correct" as const,
      note: null,
    }));
    feedback = "Correct!";
  } else {
    const grade = await gradeTranslation({ expected, userAnswer: userAnswerText, direction, wordsUsed });
    // The grader doesn't reliably follow the "accents/capitalization/punctuation
    // never count as wrong" instruction on its own (verified live — it slips some
    // of the time, including inventing a "missing" verdict for a bare punctuation
    // mark with no letters at all), so enforce it deterministically here rather
    // than trust it.
    words = grade.words.map((word) => {
      if (word.verdict === "correct") return word;
      if (word.sentenceText.length > 0 && normalizeForExactMatch(word.sentenceText).length === 0) {
        // Real content, but nothing except punctuation/whitespace — can't be a
        // real error either way. (An EMPTY sentenceText, in contrast, means the
        // model just didn't provide one — that's not the same as "just
        // punctuation" and must not silently erase a real verdict.)
        return { ...word, verdict: "correct" as const, note: null };
      }
      if (word.userSaid !== null && normalizeForExactMatch(word.userSaid) === normalizeForExactMatch(word.sentenceText)) {
        return { ...word, verdict: "correct" as const, note: null };
      }
      return word;
    });
    feedback = grade.feedback;
  }

  // Every vocab word the sentence actually used gets its own FSRS review, not just
  // the focus item — otherwise a mistake on a filler word wrongly drags down the
  // focus word's schedule, and correctly using a filler/core word never improves
  // that word's own progress. "acceptable" (synonym used instead) is skipped: it
  // proves the translation works, but nothing about knowledge of that specific word.
  // Words with no vocabWord (ordinary grammar/glue graded for feedback only, not
  // one of the tracked vocab words) have nothing to resolve/review here.
  const trackedWords = words.filter((w): w is WordVerdict & { vocabWord: string } => w.vocabWord !== null);
  const idByWord = await resolveVocabItemIds(trackedWords.map((w) => w.vocabWord));
  const exerciseType = attempt.exerciseType as ExerciseType;
  let focusRating: Parameters<typeof reviewSrsCard>[1] | null = null;
  for (const word of trackedWords) {
    if (word.verdict === "acceptable") continue;
    const vocabItemId = idByWord.get(normalizeForVocabMatch(word.vocabWord));
    if (!vocabItemId) continue;
    const rating = ratingFromWordVerdict(word.verdict);
    await applyReview(vocabItemId, exerciseType, rating);
    if (vocabItemId === attempt.vocabItemId) focusRating = rating;
  }

  // The grader can decompose a multi-word focus item (e.g. a stored example
  // sentence used whole, as sentenceGenerator's own fallback path does) into
  // finer sub-word verdicts that don't literally match its vocabItem string —
  // in which case it's never resolved/reviewed by the loop above. Every
  // attempt must still review its focus item, so guarantee it here.
  const correct = !hadMistakes(words);
  if (focusRating === null) {
    focusRating = correct ? "easy" : "again";
    await applyReview(attempt.vocabItemId, exerciseType, focusRating);
  }
  const fsrsRating = focusRating;

  await db
    .update(exerciseAttempts)
    .set({
      status: "graded",
      userAnswerText,
      isCorrect: correct,
      feedbackEn: feedback,
      fsrsRating,
      gradedAt: new Date(),
    })
    .where(eq(exerciseAttempts.id, attemptId));

  return {
    correct,
    feedbackEn: feedback,
    words,
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
  const words = result.transcript ? alignTranscriptToExpected(result.transcript, attempt.generatedSpanish) : [];

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
    words,
    correctAnswerEs: attempt.generatedSpanish,
    transcript: result.transcript,
    pronunciationScore: result.pronunciationScore,
  };
}
