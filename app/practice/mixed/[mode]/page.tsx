import Link from "next/link";
import { notFound } from "next/navigation";

import { MixedPracticeSessionPanel } from "@/components/practice/MixedPracticeSessionPanel";
import { PRACTICE_MODE_STYLES } from "@/components/practice/practiceCardStyles";
import { PRACTICE_FOCUSES, parsePracticeMode, type PracticeFocus } from "@/lib/api-utils";
import { getTopicWithBank, listTopics } from "@/lib/db/topics";
import type { TopicItemInfo } from "@/lib/practiceStats";

export default async function MixedPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { mode: modeParam } = await params;
  const { focus: focusParam } = await searchParams;

  const mode = parsePracticeMode(modeParam);
  if (!mode) notFound();

  const focus: PracticeFocus = (PRACTICE_FOCUSES as readonly string[]).includes(focusParam ?? "")
    ? (focusParam as PracticeFocus)
    : "due";

  const basePath = `/practice/mixed/${mode}`;

  const topics = await listTopics();
  const topicBanks = await Promise.all(topics.map((topic) => getTopicWithBank(topic.id)));
  const itemInfoByText: Record<string, TopicItemInfo> = {};
  for (const bank of topicBanks) {
    if (!bank) continue;
    for (const item of bank.bankItems) {
      itemInfoByText[item.spanish.trim().toLowerCase()] = { topicId: bank.topic.id, itemType: item.itemType };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-6 px-6 py-10 md:px-12">
      <div>
        <Link href="/" className="text-sm font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400">
          ← All topics
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold capitalize text-accent-600 dark:text-accent-400">
          Mixed Review — {mode} practice
        </h1>
      </div>

      <div
        className={`w-full max-w-2xl rounded-lg p-6 sm:p-8 ${PRACTICE_MODE_STYLES[mode].bg} ${PRACTICE_MODE_STYLES[mode].text} ${PRACTICE_MODE_STYLES[mode].overrides}`}
      >
        <MixedPracticeSessionPanel
          mode={mode}
          focus={focus}
          basePath={basePath}
          topics={topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            wordCount: topic.wordCount,
            sentenceCount: topic.sentenceCount,
          }))}
          itemInfoByText={itemInfoByText}
        />
      </div>
    </main>
  );
}
