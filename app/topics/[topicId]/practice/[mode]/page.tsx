import Link from "next/link";
import { notFound } from "next/navigation";

import { PRACTICE_MODE_STYLES } from "@/components/practice/practiceCardStyles";
import { PracticeSessionPanel } from "@/components/practice/PracticeSessionPanel";
import { PRACTICE_FOCUSES, parsePracticeMode, type PracticeFocus } from "@/lib/api-utils";
import { getTopicWithBank } from "@/lib/db/topics";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string; mode: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { topicId: topicIdParam, mode: modeParam } = await params;
  const { focus: focusParam } = await searchParams;

  const topicId = Number(topicIdParam);
  if (!Number.isInteger(topicId) || topicId <= 0) notFound();

  const mode = parsePracticeMode(modeParam);
  if (!mode) notFound();

  const focus: PracticeFocus = (PRACTICE_FOCUSES as readonly string[]).includes(focusParam ?? "")
    ? (focusParam as PracticeFocus)
    : "due";

  const result = await getTopicWithBank(topicId);
  if (!result) notFound();

  const basePath = `/topics/${topicId}/practice/${mode}`;
  const totalWordCount = result.bankItems.filter((item) => item.itemType === "word").length;
  const totalSentenceCount = result.bankItems.filter((item) => item.itemType === "sentence").length;
  const itemTypeByText: Record<string, "word" | "sentence"> = {};
  for (const item of result.bankItems) {
    itemTypeByText[item.spanish.trim().toLowerCase()] = item.itemType;
  }

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-6 px-6 py-10 md:px-12">
      <div>
        <Link
          href={`/topics/${topicId}`}
          className="text-sm font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400"
        >
          ← {result.topic.name}
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold capitalize text-accent-600 dark:text-accent-400">
          {mode} practice
        </h1>
      </div>

      <div
        className={`w-full max-w-2xl rounded-lg p-6 sm:p-8 ${PRACTICE_MODE_STYLES[mode].bg} ${PRACTICE_MODE_STYLES[mode].text} ${PRACTICE_MODE_STYLES[mode].overrides}`}
      >
        <PracticeSessionPanel
          scope={{ topicId }}
          mode={mode}
          focus={focus}
          basePath={basePath}
          totalWordCount={totalWordCount}
          totalSentenceCount={totalSentenceCount}
          itemTypeByText={itemTypeByText}
        />
      </div>
    </main>
  );
}
