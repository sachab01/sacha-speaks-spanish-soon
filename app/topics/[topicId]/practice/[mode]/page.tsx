import Link from "next/link";
import { notFound } from "next/navigation";

import { WritingExercise } from "@/components/practice/WritingExercise";
import { parsePracticeMode } from "@/lib/api-utils";
import { getTopicWithBank } from "@/lib/db/topics";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ topicId: string; mode: string }>;
}) {
  const { topicId: topicIdParam, mode: modeParam } = await params;

  const topicId = Number(topicIdParam);
  if (!Number.isInteger(topicId) || topicId <= 0) notFound();

  const mode = parsePracticeMode(modeParam);
  if (!mode) notFound();

  const result = await getTopicWithBank(topicId);
  if (!result) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/topics/${topicId}`} className="text-sm text-neutral-500 hover:underline">
          ← {result.topic.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold capitalize">{mode} practice</h1>
      </div>

      {mode === "writing" && <WritingExercise topicId={topicId} />}
      {mode === "speaking" && <p className="text-sm text-neutral-500">Speaking practice is coming soon.</p>}
      {mode === "listening" && <p className="text-sm text-neutral-500">Listening practice is coming soon.</p>}
    </main>
  );
}
