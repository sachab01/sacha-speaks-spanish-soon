import { and, eq, sql } from "drizzle-orm";

import { createInitialSrsCard } from "../fsrs";
import { db } from "./client";
import { EXERCISE_TYPES } from "./practice";
import { srsState, topicVocab, vocabItems } from "./schema";

export type NewVocabInput = {
  spanish: string;
  english: string;
  itemType: "word" | "sentence";
  partOfSpeech?: string | null;
  source: "bank_builder" | "tutor_qna";
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
