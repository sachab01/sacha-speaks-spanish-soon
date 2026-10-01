import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, notExists, or, sql, type SQL } from "drizzle-orm";

import { ConflictError, NotFoundError, QuotaExhaustedError } from "../errors";
import { applyMasteryDelta, ratingFromPronunciation, ratingFromWordVerdict, reviewSrsCard } from "../fsrs";
import { gradePronunciation } from "../gemini/agents/pronunciationCoach";
import { generatePracticeSentences } from "../gemini/agents/sentenceGenerator";
import { gradeTranslation, hadMistakes, type TranslationDirection, type WordVerdict } from "../gemini/agents/translationGrader";
import { FLASH_CHAIN, LITE_CHAIN } from "../gemini/quota";
import { alignTranscriptToExpected } from "../wordDiff";
import { db } from "./client";
import { exerciseAttempts, sentenceWords, sentences, srsState, topicVocab, vocabItems } from "./schema";
import { normalizeForVocabMatch, resolveVocabItemIds } from "./vocab";

export const EXERCISE_TYPES = ["writing", "speaking", "listening"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const RECENT_SENTENCE_LIMIT = 3;
/** How many due words to consider when looking for a pool sentence that isn't the one just shown. */
const POOL_CANDIDATE_LIMIT = 10;
/** Mixed Review sentences generated per request — the free-tier limits count requests, not tokens. */
const MIXED_BATCH_SIZE = 5;
/** Recent sentences the Mixed Review generator is told to avoid repeating. */
const MIXED_RECENT_LIMIT = 15;

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

/** Every word globally (already includes core vocabulary) — the vocabulary list for Mixed Review's generated sentences. */
export async function getAllCoveredVocab() {
  return db
    .select({ spanish: vocabItems.spanish, english: vocabItems.english })
    .from(vocabItems)
    .where(eq(vocabItems.itemType, "word"));
}

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
      return [
        // Prioritize items actively being relearned after a recent lapse —
        // otherwise a just-failed word's short relearning interval still sorts
        // behind an entire backlog of far-older "new"/"review" due dates
        // (all seeded at roughly bank-creation time) and effectively never
        // resurfaces. A never-reviewed ("new") item has no genuine due-date
        // urgency yet — its "due" timestamp is just its creation time — so
        // order those randomly instead of by insertion sequence, rather than
        // always drilling a fresh topic in the same fixed order.
        sql`(case ${srsState.state} when 'learning' then 0 when 'relearning' then 0 when 'review' then 1 else 2 end)`,
        sql`case when ${srsState.state} = 'new' then random() else extract(epoch from ${srsState.dueAt}) end`,
      ];
  }
}

const dueItemColumns = {
  vocabItemId: vocabItems.id,
  spanish: vocabItems.spanish,
  english: vocabItems.english,
  partOfSpeech: vocabItems.partOfSpeech,
};

async function insertPendingAttempt(values: {
  topicId: number | null;
  exerciseType: ExerciseType;
  vocabItemId: number;
  sentenceId: number | null;
  spanish: string;
  english: string;
  wordsUsed: string[];
}) {
  const [attempt] = await db
    .insert(exerciseAttempts)
    .values({
      topicId: values.topicId,
      exerciseType: values.exerciseType,
      vocabItemId: values.vocabItemId,
      sentenceId: values.sentenceId,
      status: "pending",
      generatedSpanish: values.spanish,
      generatedEnglish: values.english,
      wordsUsed: values.wordsUsed,
    })
    .returning();
  return attempt;
}

/** The vocab words (their stored spelling) a stored sentence contains — every one of them gets graded. */
async function getSentenceWords(sentenceId: number): Promise<string[]> {
  const rows = await db
    .select({ spanish: vocabItems.spanish })
    .from(sentenceWords)
    .innerJoin(vocabItems, eq(vocabItems.id, sentenceWords.vocabItemId))
    .where(eq(sentenceWords.sentenceId, sentenceId));
  return rows.map((r) => r.spanish);
}

/** The sentence shown in the most recent exercise of this type, so it's never shown twice in a row. */
async function getLastShownSentenceId(exerciseType: ExerciseType): Promise<number | null> {
  const [last] = await db
    .select({ sentenceId: exerciseAttempts.sentenceId })
    .from(exerciseAttempts)
    .where(eq(exerciseAttempts.exerciseType, exerciseType))
    .orderBy(desc(exerciseAttempts.createdAt))
    .limit(1);
  return last?.sentenceId ?? null;
}

/** Whether a topic has a stored sentence bank (built by lib/db/sentences.ts) rather than a legacy word list. */
async function hasSentencePool(topicId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: sentences.id })
    .from(sentences)
    .where(and(eq(sentences.topicId, topicId), eq(sentences.source, "bank_builder")))
    .limit(1);
  return row !== undefined;
}

/**
 * Picks a stored bank sentence for the most-due word that has one, in one
 * topic's pool or (topicId null) every topic's pool. Among the sentences
 * containing that word, the one least recently shown in this exercise type
 * wins — and the sentence shown last is skipped entirely, so the same
 * sentence never comes up twice in a row even when it covers several due
 * words. No model call involved.
 */
async function buildAttemptFromPool(params: { exerciseType: ExerciseType; topicId: number | null; focus: PracticeFocus }) {
  const { exerciseType, topicId, focus } = params;
  const poolScope =
    topicId === null
      ? eq(sentences.source, "bank_builder")
      : and(eq(sentences.source, "bank_builder"), eq(sentences.topicId, topicId));

  const pooledWordIds = db
    .select({ id: sentenceWords.vocabItemId })
    .from(sentenceWords)
    .innerJoin(sentences, eq(sentences.id, sentenceWords.sentenceId))
    .where(poolScope);

  const [candidates, lastSentenceId] = await Promise.all([
    db
      .select(dueItemColumns)
      .from(srsState)
      .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
      .where(
        and(
          eq(srsState.exerciseType, exerciseType),
          // Core glue words are graded whenever a sentence contains them, but
          // never chosen as the word to practice.
          ne(vocabItems.source, "core_vocab"),
          inArray(vocabItems.id, pooledWordIds),
          topicId === null
            ? undefined
            : inArray(
                vocabItems.id,
                db.select({ id: topicVocab.vocabItemId }).from(topicVocab).where(eq(topicVocab.topicId, topicId)),
              ),
        ),
      )
      .orderBy(...focusOrderBy(focus))
      .limit(POOL_CANDIDATE_LIMIT),
    getLastShownSentenceId(exerciseType),
  ]);

  const lastShownAt = sql`(select max(${exerciseAttempts.createdAt}) from ${exerciseAttempts} where ${exerciseAttempts.sentenceId} = ${sentences.id} and ${exerciseAttempts.exerciseType} = ${exerciseType})`;

  for (const candidate of candidates) {
    const [sentence] = await db
      .select({ id: sentences.id, topicId: sentences.topicId, spanish: sentences.spanish, english: sentences.english })
      .from(sentences)
      .innerJoin(sentenceWords, eq(sentenceWords.sentenceId, sentences.id))
      .where(
        and(
          poolScope,
          eq(sentenceWords.vocabItemId, candidate.vocabItemId),
          lastSentenceId === null ? undefined : ne(sentences.id, lastSentenceId),
        ),
      )
      .orderBy(sql`${lastShownAt} asc nulls first`, sql`random()`)
      .limit(1);
    if (!sentence) continue;

    return insertPendingAttempt({
      topicId,
      exerciseType,
      vocabItemId: candidate.vocabItemId,
      sentenceId: sentence.id,
      spanish: sentence.spanish,
      english: sentence.english,
      wordsUsed: await getSentenceWords(sentence.id),
    });
  }

  throw new NotFoundError(
    topicId === null
      ? "No topic has a sentence bank to practice from yet — turn on sentence generation, or rebuild a topic's bank."
      : "This topic has no sentences to practice yet.",
  );
}

/**
 * Legacy path for topics without a stored sentence bank: generates a fresh
 * sentence around the due item (on the high-quota model) and records a
 * pending attempt. Falls back to a bare-word prompt if generation fails.
 */
async function buildAttemptForDueItem(params: {
  exerciseType: ExerciseType;
  topicId: number;
  dueRow: DueItem;
  coveredVocab: { spanish: string; english: string }[];
}) {
  const { exerciseType, topicId, dueRow, coveredVocab } = params;
  const focusItem = { spanish: dueRow.spanish, english: dueRow.english };

  let sentence: { spanish: string; english: string; wordsUsed: string[] } = {
    spanish: focusItem.spanish,
    english: focusItem.english,
    wordsUsed: [focusItem.spanish],
  };

  // Numbers are drilled directly, never wrapped in a generated sentence.
  if (dueRow.partOfSpeech !== "number") {
    const recentAttempts = await db
      .select({ generatedSpanish: exerciseAttempts.generatedSpanish })
      .from(exerciseAttempts)
      .where(and(eq(exerciseAttempts.vocabItemId, dueRow.vocabItemId), eq(exerciseAttempts.status, "graded")))
      .orderBy(desc(exerciseAttempts.createdAt))
      .limit(RECENT_SENTENCE_LIMIT);

    try {
      const [generated] = await generatePracticeSentences({
        focusItems: [focusItem],
        coveredVocab,
        recentSentences: recentAttempts.map((a) => a.generatedSpanish),
        models: LITE_CHAIN,
        maxWaitMs: 8_000,
      });
      if (generated) sentence = generated;
    } catch (error) {
      console.error("Sentence generation failed, falling back to a bare-word prompt", error);
    }
  }

  return insertPendingAttempt({
    topicId,
    exerciseType,
    vocabItemId: dueRow.vocabItemId,
    sentenceId: null,
    spanish: sentence.spanish,
    english: sentence.english,
    wordsUsed: sentence.wordsUsed,
  });
}

/**
 * Picks the next item for one topic. Topics with a stored sentence bank
 * practice from it (no model call); older topics without one still get a
 * freshly generated sentence. Because SRS progress is shared globally per
 * vocab item, an item also used in another topic reflects progress from
 * practicing it there too.
 */
export async function getNextPracticeItem(
  topicId: number,
  exerciseType: ExerciseType,
  focus: PracticeFocus = "due",
) {
  if (await hasSentencePool(topicId)) {
    return buildAttemptFromPool({ exerciseType, topicId, focus });
  }

  const [dueRow] = await db
    .select(dueItemColumns)
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

const queuedGeneratedSentence = and(
  eq(sentences.source, "mixed_generated"),
  isNotNull(sentences.focusVocabItemId),
  notExists(db.select({ one: sql`1` }).from(exerciseAttempts).where(eq(exerciseAttempts.sentenceId, sentences.id))),
);

/** Turns the oldest not-yet-shown generated Mixed Review sentence into a pending attempt, or null if the queue is empty. */
async function takeQueuedGeneratedSentence(exerciseType: ExerciseType) {
  const [queued] = await db
    .select({
      id: sentences.id,
      spanish: sentences.spanish,
      english: sentences.english,
      focusVocabItemId: sentences.focusVocabItemId,
    })
    .from(sentences)
    .where(queuedGeneratedSentence)
    .orderBy(asc(sentences.createdAt))
    .limit(1);
  if (!queued) return null;

  return insertPendingAttempt({
    topicId: null,
    exerciseType,
    vocabItemId: queued.focusVocabItemId!,
    sentenceId: queued.id,
    spanish: queued.spanish,
    english: queued.english,
    wordsUsed: await getSentenceWords(queued.id),
  });
}

/**
 * Generates the next MIXED_BATCH_SIZE Mixed Review sentences in one request
 * — one per currently most-due word across all topics that doesn't already
 * have a queued sentence — and queues them as "mixed_generated" sentences.
 */
async function generateMixedBatch(exerciseType: ExerciseType, focus: PracticeFocus) {
  const focusRows = await db
    .select(dueItemColumns)
    .from(srsState)
    .innerJoin(vocabItems, eq(srsState.vocabItemId, vocabItems.id))
    .where(
      and(
        eq(srsState.exerciseType, exerciseType),
        eq(vocabItems.itemType, "word"),
        ne(vocabItems.source, "core_vocab"),
        or(isNull(vocabItems.partOfSpeech), ne(vocabItems.partOfSpeech, "number")),
        notExists(
          db
            .select({ one: sql`1` })
            .from(sentences)
            .where(and(queuedGeneratedSentence, eq(sentences.focusVocabItemId, vocabItems.id))),
        ),
      ),
    )
    .orderBy(...focusOrderBy(focus))
    .limit(MIXED_BATCH_SIZE);
  if (focusRows.length === 0) return;

  const [coveredVocab, recent] = await Promise.all([
    getAllCoveredVocab(),
    db
      .select({ spanish: exerciseAttempts.generatedSpanish })
      .from(exerciseAttempts)
      .orderBy(desc(exerciseAttempts.createdAt))
      .limit(MIXED_RECENT_LIMIT),
  ]);

  const generated = await generatePracticeSentences({
    focusItems: focusRows.map((r) => ({ spanish: r.spanish, english: r.english })),
    coveredVocab,
    recentSentences: recent.map((r) => r.spanish),
    models: FLASH_CHAIN,
    maxWaitMs: 10_000,
  });

  const focusByKey = new Map(focusRows.map((r) => [normalizeForVocabMatch(r.spanish), r]));
  for (const sentence of generated) {
    const focusRow = focusByKey.get(normalizeForVocabMatch(sentence.focusWord));
    if (!focusRow) continue;
    focusByKey.delete(normalizeForVocabMatch(sentence.focusWord));

    const idByWord = await resolveVocabItemIds(sentence.wordsUsed);
    const vocabIds = new Set([focusRow.vocabItemId, ...idByWord.values()]);
    const [inserted] = await db
      .insert(sentences)
      .values({
        topicId: null,
        source: "mixed_generated",
        spanish: sentence.spanish,
        english: sentence.english,
        focusVocabItemId: focusRow.vocabItemId,
      })
      .returning({ id: sentences.id });
    await db
      .insert(sentenceWords)
      .values(Array.from(vocabIds, (vocabItemId) => ({ sentenceId: inserted.id, vocabItemId })))
      .onConflictDoNothing();
  }
}

/**
 * Mixed Review's "next", across ALL topics. With `generate` on, it serves
 * freshly generated sentences (batch-generated, queued, then shown one by
 * one); once the generation quota is used up — or with `generate` off — it
 * draws from every topic's stored sentence bank instead. `notice` explains
 * a fallback to the learner.
 */
export async function getNextMixedPracticeItem(
  exerciseType: ExerciseType,
  focus: PracticeFocus = "due",
  generate = false,
): Promise<{ attempt: typeof exerciseAttempts.$inferSelect; notice: string | null }> {
  let notice: string | null = null;

  if (generate) {
    try {
      const queued = await takeQueuedGeneratedSentence(exerciseType);
      if (queued) return { attempt: queued, notice };
      await generateMixedBatch(exerciseType, focus);
      const fresh = await takeQueuedGeneratedSentence(exerciseType);
      if (fresh) return { attempt: fresh, notice };
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        notice =
          error.kind === "daily"
            ? "Today's sentence-generation limit is used up — practicing with saved sentences until it resets (around 9:00 Amsterdam time)."
            : "Sentence generation is briefly rate-limited — this one is a saved sentence.";
      } else {
        console.error("Mixed Review sentence generation failed, falling back to saved sentences", error);
        notice = "Sentence generation failed — this one is a saved sentence.";
      }
    }
  }

  return { attempt: await buildAttemptFromPool({ exerciseType, topicId: null, focus }), notice };
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
  // Only set when the grader model was actually called — the fast paths below
  // are deterministic and involve no model, so there's nothing to report.
  let gradedBy: "gemini" | "mistral" | undefined;
  let graderWarning: string | null | undefined;
  if (userAnswerText.trim() === "") {
    words = wordsUsed.map((vocabWord) => ({
      vocabWord,
      sentenceText: vocabWord,
      userSaid: null,
      verdict: "missing" as const,
      note: null,
      minorMistake: false,
    }));
    feedback = "You didn't write anything — here's the correct answer.";
  } else if (normalizeForExactMatch(userAnswerText) === normalizeForExactMatch(expected)) {
    words = wordsUsed.map((vocabWord) => ({
      vocabWord,
      sentenceText: vocabWord,
      userSaid: vocabWord,
      verdict: "correct" as const,
      note: null,
      minorMistake: false,
    }));
    feedback = "Correct!";
  } else {
    const grade = await gradeTranslation({ expected, userAnswer: userAnswerText, direction, wordsUsed });
    gradedBy = grade.gradedBy;
    graderWarning = grade.graderWarning;
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
  const idByWord = await resolveVocabItemIds([...trackedWords.map((w) => w.vocabWord), ...wordsUsed]);
  const exerciseType = attempt.exerciseType as ExerciseType;
  const correct = !hadMistakes(words);
  // Each vocab item is reviewed at most once per attempt, even if the grader
  // lists it twice; "acceptable" ones count as handled without a review.
  const handled = new Set<number>();
  let focusRating: Parameters<typeof reviewSrsCard>[1] | null = null;
  for (const word of trackedWords) {
    const vocabItemId = idByWord.get(normalizeForVocabMatch(word.vocabWord));
    if (!vocabItemId || handled.has(vocabItemId)) continue;
    handled.add(vocabItemId);
    if (word.verdict === "acceptable") continue;
    const rating = ratingFromWordVerdict(word.verdict);
    await applyReview(vocabItemId, exerciseType, rating);
    if (vocabItemId === attempt.vocabItemId) focusRating = rating;
  }

  // Every word the sentence contains must be registered as practiced, even
  // when the grader didn't return a verdict that maps back to it (e.g. it
  // decomposed a multi-word item into finer sub-word verdicts) — those fall
  // back to the whole answer's correctness. This includes the focus item.
  const fallbackRating = correct ? "easy" : "again";
  const sentenceItemIds = new Set([
    attempt.vocabItemId,
    ...wordsUsed
      .map((w) => idByWord.get(normalizeForVocabMatch(w)))
      .filter((id): id is number => id !== undefined),
  ]);
  for (const vocabItemId of sentenceItemIds) {
    if (handled.has(vocabItemId)) continue;
    await applyReview(vocabItemId, exerciseType, fallbackRating);
    if (vocabItemId === attempt.vocabItemId) focusRating = fallbackRating;
  }
  focusRating ??= fallbackRating;
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
    gradedBy,
    graderWarning,
  };
}

/** Grades a speaking attempt from recorded mic audio. */
export async function submitSpeakingAttempt(params: { attemptId: string; audioBytes: Buffer; mimeType: string }) {
  const { attemptId, audioBytes, mimeType } = params;
  const attempt = await loadPendingAttempt(attemptId);

  const result = await gradePronunciation({ expectedEs: attempt.generatedSpanish, audioBytes, mimeType });
  const rating = ratingFromPronunciation(result);
  const exerciseType = attempt.exerciseType as ExerciseType;
  const isCorrect = await applyReview(attempt.vocabItemId, exerciseType, rating);
  // Saying the sentence practices every word in it, not just the focus word,
  // so they all get the same pronunciation-based review.
  const idByWord = await resolveVocabItemIds(attempt.wordsUsed);
  for (const vocabItemId of new Set(idByWord.values())) {
    if (vocabItemId !== attempt.vocabItemId) await applyReview(vocabItemId, exerciseType, rating);
  }
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
