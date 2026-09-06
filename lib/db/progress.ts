import { eq } from "drizzle-orm";

import type { SrsCardState } from "../fsrs";
import { db } from "./client";
import { EXERCISE_TYPES, type ExerciseType } from "./practice";
import { srsState, topicVocab, vocabItems } from "./schema";

/** A mastery score of 50 alone can't tell "never practiced" from "practiced and landed at 50" — `practiced` disambiguates. */
export type SkillCell = { score: number; practiced: boolean };

export type WordSkill = {
  vocabItemId: number;
  spanish: string;
  english: string;
  itemType: "word" | "sentence";
  skill: Record<ExerciseType, SkillCell>;
  average: number;
  /** Never graded in any exercise type yet. */
  isNew: boolean;
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
    const total = words.reduce((sum, w) => sum + w.skill[exerciseType].score, 0);
    averageSkill[exerciseType] = words.length > 0 ? Math.round(total / words.length) : 0;
  }
  for (const word of words) {
    if (word.isNew) newCount += 1;
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
    masteryScore: number;
    state: SrsCardState;
  }[],
): WordSkill[] {
  const byItem = new Map<number, WordSkill>();

  for (const row of rows) {
    let entry = byItem.get(row.vocabItemId);
    if (!entry) {
      entry = {
        vocabItemId: row.vocabItemId,
        spanish: row.spanish,
        english: row.english,
        itemType: row.itemType,
        skill: {
          writing: { score: 50, practiced: false },
          speaking: { score: 50, practiced: false },
          listening: { score: 50, practiced: false },
        },
        average: 0,
        isNew: false,
      };
      byItem.set(row.vocabItemId, entry);
    }
    entry.skill[row.exerciseType] = { score: row.masteryScore, practiced: row.state !== "new" };
  }

  const words = Array.from(byItem.values());
  for (const word of words) {
    word.average = Math.round(
      (word.skill.writing.score + word.skill.speaking.score + word.skill.listening.score) / EXERCISE_TYPES.length,
    );
    word.isNew = EXERCISE_TYPES.every((type) => !word.skill[type].practiced);
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
      masteryScore: srsState.masteryScore,
      state: srsState.state,
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
      masteryScore: srsState.masteryScore,
      state: srsState.state,
    })
    .from(vocabItems)
    .innerJoin(srsState, eq(srsState.vocabItemId, vocabItems.id));

  const words = buildWordSkills(rows);
  return { summary: summarize(words), words };
}
