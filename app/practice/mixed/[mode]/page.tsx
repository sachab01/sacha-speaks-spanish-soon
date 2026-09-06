import Link from "next/link";
import { notFound } from "next/navigation";

import { FocusSelector } from "@/components/practice/FocusSelector";
import { ListeningExercise } from "@/components/practice/ListeningExercise";
import { SpeakingExercise } from "@/components/practice/SpeakingExercise";
import { WritingExercise } from "@/components/practice/WritingExercise";
import { PRACTICE_FOCUSES, parsePracticeMode, type PracticeFocus } from "@/lib/api-utils";

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

  const scope = { mixed: true as const };
  const basePath = `/practice/mixed/${mode}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← All topics
        </Link>
        <h1 className="mt-2 text-2xl font-semibold capitalize">Mixed Review — {mode} practice</h1>
      </div>

      <FocusSelector basePath={basePath} current={focus} />

      {mode === "writing" && <WritingExercise scope={scope} focus={focus} />}
      {mode === "speaking" && <SpeakingExercise scope={scope} focus={focus} />}
      {mode === "listening" && <ListeningExercise scope={scope} focus={focus} />}
    </main>
  );
}
