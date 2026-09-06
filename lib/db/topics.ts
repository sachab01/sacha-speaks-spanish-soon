import { eq, sql } from "drizzle-orm";

import { generateBank } from "../gemini/agents/bankBuilder";
import { createInitialSrsCard } from "../fsrs";
import { db } from "./client";
import { bankItems, srsState, topics } from "./schema";

const EXERCISE_TYPES = ["writing", "speaking", "listening"] as const;

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
      wordCount: sql<number>`count(*) filter (where ${bankItems.itemType} = 'word')`.mapWith(Number),
      sentenceCount: sql<number>`count(*) filter (where ${bankItems.itemType} = 'sentence')`.mapWith(Number),
    })
    .from(topics)
    .leftJoin(bankItems, eq(bankItems.topicId, topics.id))
    .groupBy(topics.id)
    .orderBy(topics.createdAt);
}

export async function getTopicWithBank(topicId: number) {
  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
  if (!topic) return null;

  const items = await db
    .select()
    .from(bankItems)
    .where(eq(bankItems.topicId, topicId))
    .orderBy(bankItems.createdAt);

  return { topic, bankItems: items };
}

/**
 * Generates a bank via Gemini and persists it. The neon-http driver doesn't
 * support real multi-statement transactions, so this uses the topic row's
 * ON DELETE CASCADE as a compensating rollback: if a later insert fails, the
 * topic (and any bank items already inserted for it) is deleted before the
 * error is re-thrown, rather than leaving a half-created topic behind.
 */
export async function createTopic(name: string) {
  const bank = await generateBank(name);

  const [topic] = await db.insert(topics).values({ name }).returning();

  try {
    const rows = [
      ...bank.words.map((word) => ({
        topicId: topic.id,
        itemType: "word" as const,
        spanish: word.spanish,
        english: word.english,
        partOfSpeech: word.partOfSpeech,
        source: "bank_builder" as const,
      })),
      ...bank.sentences.map((sentence) => ({
        topicId: topic.id,
        itemType: "sentence" as const,
        spanish: sentence.spanish,
        english: sentence.english,
        partOfSpeech: null,
        source: "bank_builder" as const,
      })),
    ];

    const insertedItems = await db.insert(bankItems).values(rows).returning();

    const now = new Date();
    const srsRows = insertedItems.flatMap((item) =>
      EXERCISE_TYPES.map((exerciseType) => ({
        bankItemId: item.id,
        exerciseType,
        ...createInitialSrsCard(now),
      })),
    );
    await db.insert(srsState).values(srsRows);

    return { topic, bankItems: insertedItems };
  } catch (error) {
    await db.delete(topics).where(eq(topics.id, topic.id));
    throw error;
  }
}
