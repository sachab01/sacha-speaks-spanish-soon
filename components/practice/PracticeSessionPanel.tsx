"use client";

import { useMemo } from "react";

import { FocusSelector } from "@/components/practice/FocusSelector";
import { ListeningExercise } from "@/components/practice/ListeningExercise";
import { SpeakingExercise } from "@/components/practice/SpeakingExercise";
import { WritingExercise } from "@/components/practice/WritingExercise";
import { CoverageBar } from "@/components/ui/CoverageBar";
import { useSessionCoverage } from "@/hooks/useSessionCoverage";
import type { PracticeFocus, PracticeMode, PracticeScope } from "@/hooks/usePracticeSession";
import { computeSessionCoverage } from "@/lib/practiceStats";

/**
 * Wraps one topic's practice exercise together with a session-only coverage
 * readout — words/sentences discussed and their mean score just for this
 * session, reset on page reload, distinct from the persisted/overall mean
 * shown on the topic page. `itemTypeByText` (a normalized-text -> "word"|
 * "sentence" lookup built server-side from the topic's bank) classifies each
 * item as it's practiced; passed as a plain object since Map isn't
 * serializable across the server/client boundary.
 */
export function PracticeSessionPanel({
  scope,
  mode,
  focus,
  basePath,
  totalWordCount,
  totalSentenceCount,
  itemTypeByText,
}: {
  scope: PracticeScope;
  mode: PracticeMode;
  focus: PracticeFocus;
  basePath: string;
  totalWordCount: number;
  totalSentenceCount: number;
  itemTypeByText: Record<string, "word" | "sentence">;
}) {
  const { wordScores, recordResult } = useSessionCoverage();
  const itemTypeMap = useMemo(() => new Map(Object.entries(itemTypeByText)), [itemTypeByText]);
  const coverage = computeSessionCoverage(wordScores, itemTypeMap);
  const variant = mode === "listening" ? "ink" : "cream";

  return (
    <div className="flex flex-col gap-5">
      <FocusSelector basePath={basePath} current={focus} inverted />

      {wordScores.size > 0 && (
        <div className="flex flex-col gap-2">
          <CoverageBar
            label="Words this session"
            stats={{ ...coverage.words, totalCount: totalWordCount }}
            variant={variant}
          />
          <CoverageBar
            label="Sentences this session"
            stats={{ ...coverage.sentences, totalCount: totalSentenceCount }}
            variant={variant}
          />
        </div>
      )}

      {mode === "writing" && <WritingExercise scope={scope} focus={focus} onResult={recordResult} />}
      {mode === "speaking" && <SpeakingExercise scope={scope} focus={focus} onResult={recordResult} />}
      {mode === "listening" && <ListeningExercise scope={scope} focus={focus} onResult={recordResult} />}
    </div>
  );
}
