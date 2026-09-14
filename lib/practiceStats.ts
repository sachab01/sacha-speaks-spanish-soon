import type { WordSkill } from "./db/progress";

export type CoverageStats = {
  practicedCount: number;
  totalCount: number;
  /** Null when nothing has been practiced yet. */
  meanScore: number | null;
};

export type CoverageBreakdown = { words: CoverageStats; sentences: CoverageStats };

function meanOf(scores: number[]): number | null {
  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

function coverageForType(items: WordSkill[], itemType: "word" | "sentence"): CoverageStats {
  const matching = items.filter((item) => item.itemType === itemType);
  const practiced = matching.filter((item) => !item.isNew);
  const scores = practiced.flatMap((item) =>
    Object.values(item.skill)
      .filter((cell) => cell.practiced)
      .map((cell) => cell.score),
  );
  return { practicedCount: practiced.length, totalCount: matching.length, meanScore: meanOf(scores) };
}

/**
 * Practiced count and mean score, split by itemType ("words practiced" and
 * "sentences practiced" are different figures, not one conflated count) and
 * computed from individually-practiced SkillCells rather than trusting
 * WordSkill.average or SkillSummary.averageSkill directly — those blend in the
 * default-50 placeholder score for exercise types a word hasn't been drilled in
 * yet, which would skew a "how am I actually doing" figure toward the middle.
 */
export function computeCoverage(items: WordSkill[]): CoverageBreakdown {
  return { words: coverageForType(items, "word"), sentences: coverageForType(items, "sentence") };
}

/**
 * Session-only coverage (client-side only, reset on page reload) for whatever
 * items a `Map<normalizedText, score>` — built up from per-attempt verdicts as
 * the session progresses — currently holds, split into words vs sentences via
 * `itemTypeByText` (a normalized-text -> itemType lookup built server-side from
 * the relevant topic's/topics' bank). Deliberately not the same "mean score" as
 * the persisted/overall one.
 */
export function computeSessionCoverage(
  itemScores: Map<string, number>,
  itemTypeByText: Map<string, "word" | "sentence">,
): CoverageBreakdown {
  const wordScores: number[] = [];
  const sentenceScores: number[] = [];
  for (const [text, score] of itemScores) {
    const itemType = itemTypeByText.get(text);
    if (itemType === "word") wordScores.push(score);
    else if (itemType === "sentence") sentenceScores.push(score);
  }
  return {
    words: { practicedCount: wordScores.length, totalCount: wordScores.length, meanScore: meanOf(wordScores) },
    sentences: {
      practicedCount: sentenceScores.length,
      totalCount: sentenceScores.length,
      meanScore: meanOf(sentenceScores),
    },
  };
}

export type TopicItemInfo = { topicId: number; itemType: "word" | "sentence" };

/**
 * Buckets session item-scores by topic (and, within each topic, by word vs
 * sentence) for a mixed-review breakdown. `itemInfoByText` maps a normalized
 * (trimmed, lowercased) vocab word/sentence to the topic and item type it
 * belongs to — items the grader echoed back that don't match any known topic
 * item (e.g. glue words) are silently skipped rather than shown as a broken
 * "topic".
 */
export function computeSessionCoverageByTopic(
  itemScores: Map<string, number>,
  itemInfoByText: Map<string, TopicItemInfo>,
): Map<number, CoverageBreakdown> {
  const scoresByTopic = new Map<number, { words: number[]; sentences: number[] }>();
  for (const [text, score] of itemScores) {
    const info = itemInfoByText.get(text);
    if (!info) continue;
    const bucket = scoresByTopic.get(info.topicId) ?? { words: [], sentences: [] };
    bucket[info.itemType === "word" ? "words" : "sentences"].push(score);
    scoresByTopic.set(info.topicId, bucket);
  }

  const result = new Map<number, CoverageBreakdown>();
  for (const [topicId, { words, sentences }] of scoresByTopic) {
    result.set(topicId, {
      words: { practicedCount: words.length, totalCount: words.length, meanScore: meanOf(words) },
      sentences: { practicedCount: sentences.length, totalCount: sentences.length, meanScore: meanOf(sentences) },
    });
  }
  return result;
}

/** Maps a per-word grading verdict to a coarse 0-100 score for session-only display. */
export function verdictScore(verdict: "correct" | "acceptable" | "wrong" | "missing"): number {
  switch (verdict) {
    case "correct":
      return 100;
    case "acceptable":
      return 75;
    case "wrong":
      return 25;
    case "missing":
      return 0;
  }
}
