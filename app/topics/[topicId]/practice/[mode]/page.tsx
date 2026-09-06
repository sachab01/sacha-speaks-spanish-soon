import Link from "next/link";
import { notFound } from "next/navigation";

import { FocusSelector } from "@/components/practice/FocusSelector";
import { ListeningExercise } from "@/components/practice/ListeningExercise";
import { SpeakingExercise } from "@/components/practice/SpeakingExercise";
import { WritingExercise } from "@/components/practice/WritingExercise";
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/topics/${topicId}`} className="text-sm text-neutral-500 hover:underline">
          ← {result.topic.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold capitalize">{mode} practice</h1>
      </div>

      <FocusSelector basePath={basePath} current={focus} />

      {mode === "writing" && <WritingExercise scope={{ topicId }} focus={focus} />}
      {mode === "speaking" && <SpeakingExercise scope={{ topicId }} focus={focus} />}
      {mode === "listening" && <ListeningExercise scope={{ topicId }} focus={focus} />}
    </main>
  );
}
