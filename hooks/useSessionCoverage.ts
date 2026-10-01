"use client";

import { useCallback, useState } from "react";

import type { AttemptResult } from "@/hooks/usePracticeSession";
import { verdictScore } from "@/lib/practiceStats";

/**
 * Tracks which vocab words have come up in this practice session (client-side
 * only, reset on page reload) and each one's latest verdict-derived score —
 * deliberately separate from the persisted/overall mastery score shown
 * elsewhere. Feed `recordResult` as the `onResult` callback into a practice
 * exercise component.
 */
export function useSessionCoverage() {
  const [wordScores, setWordScores] = useState<Map<string, number>>(new Map());

  const recordResult = useCallback((result: AttemptResult) => {
    if (!result.words || result.words.length === 0) return;
    setWordScores((previous) => {
      const next = new Map(previous);
      for (const word of result.words ?? []) {
        if (!word.vocabWord) continue;
        next.set(word.vocabWord.trim().toLowerCase(), verdictScore(word.verdict));
      }
      // The sentence itself counts as practiced too — for a topic built as a
      // sentence bank it's never one of the graded vocab words above.
      if (result.correctAnswerEs) {
        const scores = (result.words ?? []).map((w) => verdictScore(w.verdict));
        const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        next.set(result.correctAnswerEs.trim().toLowerCase(), mean);
      }
      return next;
    });
  }, []);

  return { wordScores, recordResult };
}
