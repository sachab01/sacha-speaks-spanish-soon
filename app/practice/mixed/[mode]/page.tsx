import Link from "next/link";
import { notFound } from "next/navigation";

import { ListeningExercise } from "@/components/practice/ListeningExercise";
import { SpeakingExercise } from "@/components/practice/SpeakingExercise";
import { WritingExercise } from "@/components/practice/WritingExercise";
import { parsePracticeMode } from "@/lib/api-utils";

export default async function MixedPracticePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode: modeParam } = await params;

  const mode = parsePracticeMode(modeParam);
  if (!mode) notFound();

  const scope = { mixed: true as const };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← All topics
        </Link>
        <h1 className="mt-2 text-2xl font-semibold capitalize">Mixed Review — {mode} practice</h1>
      </div>

      {mode === "writing" && <WritingExercise scope={scope} />}
      {mode === "speaking" && <SpeakingExercise scope={scope} />}
      {mode === "listening" && <ListeningExercise scope={scope} />}
    </main>
  );
}
