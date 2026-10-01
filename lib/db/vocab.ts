import { and, eq, or, sql } from "drizzle-orm";

import { createInitialSrsCard } from "../fsrs";
import { db } from "./client";
import { EXERCISE_TYPES } from "./practice";
import { srsState, topicVocab, vocabItems } from "./schema";

export type NewVocabInput = {
  spanish: string;
  english: string;
  itemType: "word" | "sentence";
  partOfSpeech?: string | null;
  source: "bank_builder" | "tutor_qna" | "core_vocab";
};

/**
 * Finds an existing vocab item by exact (case-insensitive) Spanish spelling,
 * or creates one with due-now SRS rows for all exercise types. Vocabulary is
 * global: the same word reused across topics shares one row and one set of
 * SRS progress, so practicing it via any topic (or Mixed Review) counts
 * everywhere it appears. Different grammatical forms (plural, other persons,
 * etc.) are different strings and intentionally stay separate rows — this
 * only merges literal duplicates, not lemmas.
 */
export async function findOrCreateVocabItem(
  input: NewVocabInput,
): Promise<{ vocabItem: typeof vocabItems.$inferSelect; created: boolean }> {
  const [existing] = await db
    .select()
    .from(vocabItems)
    .where(sql`lower(${vocabItems.spanish}) = lower(${input.spanish})`);

  if (existing) {
    return { vocabItem: existing, created: false };
  }

  const [inserted] = await db
    .insert(vocabItems)
    .values({
      itemType: input.itemType,
      spanish: input.spanish,
      english: input.english,
      partOfSpeech: input.partOfSpeech ?? null,
      source: input.source,
    })
    .returning();

  const now = new Date();
  await db.insert(srsState).values(
    EXERCISE_TYPES.map((exerciseType) => ({
      vocabItemId: inserted.id,
      exerciseType,
      ...createInitialSrsCard(now),
    })),
  );

  return { vocabItem: inserted, created: true };
}

/** Links a vocab item to a topic if not already linked. Returns whether a new link was made. */
export async function linkVocabToTopic(topicId: number, vocabItemId: number): Promise<boolean> {
  const [existingLink] = await db
    .select()
    .from(topicVocab)
    .where(and(eq(topicVocab.topicId, topicId), eq(topicVocab.vocabItemId, vocabItemId)));

  if (existingLink) return false;

  await db.insert(topicVocab).values({ topicId, vocabItemId });
  return true;
}

/**
 * Normalizes for matching a grader-echoed vocab word back to its stored vocabItem —
 * the model doesn't always reproduce trailing punctuation exactly (e.g. echoing
 * "No entiendo" for a stored "No entiendo."), so comparison ignores punctuation
 * and whitespace differences. Accents are kept, since they distinguish real words
 * (e.g. "el"/"él", "tu"/"tú").
 */
export function normalizeForVocabMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'()«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lookup of vocabItem ids by Spanish spelling (punctuation/whitespace-insensitive) — resolves a grader's echoed-back vocab words to real ids. */
export async function resolveVocabItemIds(spanishForms: string[]): Promise<Map<string, number>> {
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
