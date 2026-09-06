import Link from "next/link";
import { notFound } from "next/navigation";

import { BankView } from "@/components/BankView";
import { SkillSummary } from "@/components/progress/SkillSummary";
import { SkillTable } from "@/components/progress/SkillTable";
import { getTopicSkillOverview } from "@/lib/db/progress";
import { getTopicWithBank } from "@/lib/db/topics";

// Skill decays continuously with time since last review, so this must never be statically cached.
export const dynamic = "force-dynamic";

const PRACTICE_MODES = ["writing", "speaking", "listening"] as const;

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const id = Number(topicId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const result = await getTopicWithBank(id);
  if (!result) notFound();

  const { topic, bankItems } = result;
  const { summary, words } = await getTopicSkillOverview(id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← All topics
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{topic.name}</h1>
      </div>

      <nav className="flex gap-2">
        {PRACTICE_MODES.map((mode) => (
          <Link
            key={mode}
            href={`/topics/${topic.id}/practice/${mode}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm capitalize hover:border-neutral-500 dark:border-neutral-700"
          >
            {mode}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-500 uppercase">Your skill</h2>
        <div className="flex flex-col gap-3">
          <SkillSummary summary={summary} />
          <SkillTable words={words} />
        </div>
      </section>

      <BankView bankItems={bankItems} />
    </main>
  );
}
