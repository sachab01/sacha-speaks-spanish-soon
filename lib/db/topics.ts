import { eq, sql } from "drizzle-orm";

import { generateBank } from "../gemini/agents/bankBuilder";
import { db } from "./client";
import { topicVocab, topics, vocabItems } from "./schema";
import { findOrCreateVocabItem, linkVocabToTopic } from "./vocab";

export type TopicSummary = {
  id: number;
  name: string;
  createdAt: Date;
  wordCount: number;
  sentenceCount: number;
};

export async function listTopics(): Promise<TopicSummary[]> {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      createdAt: topics.createdAt,
      wordCount: sql<number>`count(*) filter (where ${vocabItems.itemType} = 'word')`.mapWith(Number),
      sentenceCount: sql<number>`count(*) filter (where ${vocabItems.itemType} = 'sentence')`.mapWith(Number),
    })
    .from(topics)
    .leftJoin(topicVocab, eq(topicVocab.topicId, topics.id))
    .leftJoin(vocabItems, eq(vocabItems.id, topicVocab.vocabItemId))
    .groupBy(topics.id)
    .orderBy(topics.createdAt);
}

export async function getTopicWithBank(topicId: number) {
  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
  if (!topic) return null;

  const items = await db
    .select({
      id: vocabItems.id,
      itemType: vocabItems.itemType,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
      partOfSpeech: vocabItems.partOfSpeech,
      source: vocabItems.source,
      createdAt: vocabItems.createdAt,
    })
    .from(topicVocab)
    .innerJoin(vocabItems, eq(vocabItems.id, topicVocab.vocabItemId))
    .where(eq(topicVocab.topicId, topicId))
    .orderBy(vocabItems.createdAt);

  return { topic, bankItems: items };
}

export type VocabEntry = {
  spanish: string;
  english: string;
  itemType: "word" | "sentence";
  partOfSpeech?: string | null;
};

/**
 * Deduped-and-links a batch of vocab entries into a topic (see
 * findOrCreateVocabItem/linkVocabToTopic) — reused by both createTopic
 * (Gemini-generated entries) and one-off backfill scripts (hand-curated
 * entries), since both just need "make sure this topic covers these words."
 */
export async function seedVocabEntries(topicId: number, entries: VocabEntry[], source: "bank_builder" | "tutor_qna") {
  const linkedItems: (typeof vocabItems.$inferSelect)[] = [];
  for (const entry of entries) {
    const { vocabItem } = await findOrCreateVocabItem({
      spanish: entry.spanish,
      english: entry.english,
      itemType: entry.itemType,
      partOfSpeech: entry.partOfSpeech ?? null,
      source,
    });
    await linkVocabToTopic(topicId, vocabItem.id);
    linkedItems.push(vocabItem);
  }
  return linkedItems;
}

/**
 * Generates a bank via Gemini and persists it. Each word/sentence is
 * deduped globally (see findOrCreateVocabItem) before being linked to this
 * topic, so a word already known from another topic is reused rather than
 * creating a second copy with its own separate progress.
 *
 * The neon-http driver doesn't support real multi-statement transactions,
 * so this uses the topic row's ON DELETE CASCADE as a compensating rollback:
 * if a later insert fails, the topic (and any topic_vocab links already
 * made for it) is deleted before the error is re-thrown, rather than
 * leaving a half-created topic behind. Reused vocab_items/srsState rows
 * are never touched by that rollback, since they aren't owned by this topic.
 */
export async function createTopic(name: string) {
  const bank = await generateBank(name);

  const [topic] = await db.insert(topics).values({ name }).returning();

  try {
    const entries: VocabEntry[] = [
      ...bank.words.map((w) => ({
        spanish: w.spanish,
        english: w.english,
        itemType: "word" as const,
        partOfSpeech: w.partOfSpeech as string | null,
      })),
      ...bank.sentences.map((s) => ({
        spanish: s.spanish,
        english: s.english,
        itemType: "sentence" as const,
        partOfSpeech: null,
      })),
    ];

    const bankItems = await seedVocabEntries(topic.id, entries, "bank_builder");
    return { topic, bankItems };
  } catch (error) {
    await db.delete(topics).where(eq(topics.id, topic.id));
    throw error;
  }
}
