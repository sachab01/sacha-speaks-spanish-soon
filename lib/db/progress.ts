import { eq } from "drizzle-orm";

import { computeRetrievability, type SrsCardState } from "../fsrs";
import { db } from "./client";
import { EXERCISE_TYPES, type ExerciseType } from "./practice";
import { srsState, topicVocab, vocabItems } from "./schema";

export type WordSkill = {
  vocabItemId: number;
  spanish: string;
  english: string;
  itemType: "word" | "sentence";
  skill: Record<ExerciseType, number>;
  average: number;
};

export type SkillSummary = {
  wordCount: number;
  averageSkill: Record<ExerciseType, number>;
  newCount: number;
};

function summarize(words: WordSkill[]): SkillSummary {
  const averageSkill = { writing: 0, speaking: 0, listening: 0 } as Record<ExerciseType, number>;
  let newCount = 0;

  for (const exerciseType of EXERCISE_TYPES) {
    const total = words.reduce((sum, w) => sum + w.skill[exerciseType], 0);
    averageSkill[exerciseType] = words.length > 0 ? Math.round(total / words.length) : 0;
  }
  for (const word of words) {
    if (EXERCISE_TYPES.every((type) => word.skill[type] === 0)) newCount += 1;
  }

  return { wordCount: words.length, averageSkill, newCount };
}

function buildWordSkills(
  rows: {
    vocabItemId: number;
    spanish: string;
    english: string;
    itemType: "word" | "sentence";
    exerciseType: ExerciseType;
    state: SrsCardState;
    stability: number;
    lastReviewAt: Date | null;
  }[],
): WordSkill[] {
  const byItem = new Map<number, WordSkill>();
  const now = new Date();

  for (const row of rows) {
    let entry = byItem.get(row.vocabItemId);
    if (!entry) {
      entry = {
        vocabItemId: row.vocabItemId,
        spanish: row.spanish,
        english: row.english,
        itemType: row.itemType,
        skill: { writing: 0, speaking: 0, listening: 0 },
        average: 0,
      };
      byItem.set(row.vocabItemId, entry);
    }
    entry.skill[row.exerciseType] = computeRetrievability(
      { state: row.state, stability: row.stability, lastReviewAt: row.lastReviewAt },
      now,
    );
  }

  const words = Array.from(byItem.values());
  for (const word of words) {
    word.average = Math.round(
      (word.skill.writing + word.skill.speaking + word.skill.listening) / EXERCISE_TYPES.length,
    );
  }
  // Weakest first, so the words most worth reviewing are immediately visible.
  words.sort((a, b) => a.average - b.average);
  return words;
}

export async function getTopicSkillOverview(topicId: number) {
  const rows = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
      itemType: vocabItems.itemType,
      exerciseType: srsState.exerciseType,
      state: srsState.state,
      stability: srsState.stability,
      lastReviewAt: srsState.lastReviewAt,
    })
    .from(topicVocab)
    .innerJoin(vocabItems, eq(vocabItems.id, topicVocab.vocabItemId))
    .innerJoin(srsState, eq(srsState.vocabItemId, vocabItems.id))
    .where(eq(topicVocab.topicId, topicId));

  const words = buildWordSkills(rows);
  return { summary: summarize(words), words };
}

export async function getOverallSkillOverview() {
  const rows = await db
    .select({
      vocabItemId: vocabItems.id,
      spanish: vocabItems.spanish,
      english: vocabItems.english,
      itemType: vocabItems.itemType,
      exerciseType: srsState.exerciseType,
      state: srsState.state,
      stability: srsState.stability,
      lastReviewAt: srsState.lastReviewAt,
    })
    .from(vocabItems)
    .innerJoin(srsState, eq(srsState.vocabItemId, vocabItems.id));

  const words = buildWordSkills(rows);
  return { summary: summarize(words), words };
}
