"use client";

import { useMemo } from "react";

import Link from "next/link";

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
  generate,
  basePath,
  topics,
  itemInfoByText,
}: {
  mode: PracticeMode;
  focus: PracticeFocus;
  /** Freshly generated sentences (uses the daily model quota) instead of the topics' stored ones. */
  generate: boolean;
  basePath: string;
  topics: TopicInfo[];
  itemInfoByText: Record<string, TopicItemInfo>;
}) {
  const { wordScores, recordResult } = useSessionCoverage();
  const itemInfoMap = useMemo(() => new Map(Object.entries(itemInfoByText)), [itemInfoByText]);
  const coverageByTopic = computeSessionCoverageByTopic(wordScores, itemInfoMap);
  const topicsWithCoverage = topics.filter((topic) => coverageByTopic.has(topic.id));
  const variant = mode === "listening" ? "ink" : "cream";
  const scope = { mixed: true as const, generate };
  const focusQuery = focus === "due" ? "" : `focus=${focus}`;
  const toggleQuery = [focusQuery, generate ? "" : "generate=1"].filter(Boolean).join("&");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FocusSelector basePath={basePath} current={focus} inverted extraQuery={generate ? "generate=1" : ""} />
        <Link
          href={toggleQuery ? `${basePath}?${toggleQuery}` : basePath}
          role="switch"
          aria-checked={generate}
          className="flex items-center gap-2 text-sm font-bold"
          title="Generate new sentences with AI (limited per day) instead of using the topics' saved sentences"
        >
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-current transition-colors ${generate ? "bg-current" : ""}`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${generate ? "left-[18px] bg-[var(--background)]" : "left-0.5 bg-current"}`}
            />
          </span>
          New sentences
        </Link>
      </div>

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

      {mode === "writing" && <WritingExercise scope={scope} focus={focus} onResult={recordResult} />}
      {mode === "speaking" && <SpeakingExercise scope={scope} focus={focus} onResult={recordResult} />}
      {mode === "listening" && <ListeningExercise scope={scope} focus={focus} onResult={recordResult} />}
    </div>
  );
}
