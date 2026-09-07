"use client";

import { useMemo } from "react";

import { FocusSelector } from "@/components/practice/FocusSelector";
import { ListeningExercise } from "@/components/practice/ListeningExercise";
import { SpeakingExercise } from "@/components/practice/SpeakingExercise";
import { WritingExercise } from "@/components/practice/WritingExercise";
import { CoverageBar } from "@/components/ui/CoverageBar";
import { useSessionCoverage } from "@/hooks/useSessionCoverage";
import type { PracticeFocus, PracticeMode } from "@/hooks/usePracticeSession";
import { computeSessionCoverageByTopic, type TopicItemInfo } from "@/lib/practiceStats";

type TopicInfo = { id: number; name: string; wordCount: number; sentenceCount: number };

/**
 * Mixed Review's version of PracticeSessionPanel: instead of one aggregate
 * "X of Y" figure, breaks the session's coverage down per topic — since a
 * mixed session draws from every topic's due words and sentences, not just
 * one. `itemInfoByText` (a normalized vocab word/sentence -> {topicId, itemType}
 * lookup, built server-side from every topic's bank) attributes each graded
 * item back to its topic; passed as a plain object since Map isn't
 * serializable across the server/client boundary.
 */
export function MixedPracticeSessionPanel({
  mode,
  focus,
  basePath,
  topics,
  itemInfoByText,
}: {
  mode: PracticeMode;
  focus: PracticeFocus;
  basePath: string;
  topics: TopicInfo[];
  itemInfoByText: Record<string, TopicItemInfo>;
}) {
  const { wordScores, recordResult } = useSessionCoverage();
  const itemInfoMap = useMemo(() => new Map(Object.entries(itemInfoByText)), [itemInfoByText]);
  const coverageByTopic = computeSessionCoverageByTopic(wordScores, itemInfoMap);
  const topicsWithCoverage = topics.filter((topic) => coverageByTopic.has(topic.id));
  const variant = mode === "listening" ? "ink" : "cream";

  return (
    <div className="flex flex-col gap-5">
      <FocusSelector basePath={basePath} current={focus} inverted />

      {topicsWithCoverage.length > 0 && (
        <div className="flex flex-col gap-4">
          {topicsWithCoverage.map((topic) => {
            const coverage = coverageByTopic.get(topic.id)!;
            return (
              <div key={topic.id} className="flex flex-col gap-2">
                <p className="truncate text-sm font-black">{topic.name}</p>
                <CoverageBar
                  label="Words"
                  stats={{ ...coverage.words, totalCount: topic.wordCount }}
                  variant={variant}
                />
                <CoverageBar
                  label="Sentences"
                  stats={{ ...coverage.sentences, totalCount: topic.sentenceCount }}
                  variant={variant}
                />
              </div>
            );
          })}
        </div>
      )}

      {mode === "writing" && <WritingExercise scope={{ mixed: true }} focus={focus} onResult={recordResult} />}
      {mode === "speaking" && <SpeakingExercise scope={{ mixed: true }} focus={focus} onResult={recordResult} />}
      {mode === "listening" && <ListeningExercise scope={{ mixed: true }} focus={focus} onResult={recordResult} />}
    </div>
  );
}
