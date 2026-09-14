import Link from "next/link";
import { notFound } from "next/navigation";

import { BankView } from "@/components/BankView";
import { SkillSummary } from "@/components/progress/SkillSummary";
import { SkillTable } from "@/components/progress/SkillTable";
import { TopicDeleteButton } from "@/components/TopicDeleteButton";
import { MicIcon, PencilIcon, SpeakerIcon } from "@/components/ui/icons";
import { getTopicSkillOverview } from "@/lib/db/progress";
import { getTopicWithBank } from "@/lib/db/topics";

// Skill decays continuously with time since last review, so this must never be statically cached.
export const dynamic = "force-dynamic";

const PRACTICE_MODES = [
  { mode: "writing", icon: PencilIcon, bg: "bg-accent-600 hover:bg-accent-700", text: "text-[var(--background)]" },
  { mode: "speaking", icon: MicIcon, bg: "bg-blue hover:bg-blue-dark", text: "text-[var(--background)]" },
  { mode: "listening", icon: SpeakerIcon, bg: "bg-mustard hover:bg-mustard-dark", text: "text-ink" },
] as const;

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const id = Number(topicId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const result = await getTopicWithBank(id);
  if (!result) notFound();

  const { topic, bankItems } = result;
  const { summary, words } = await getTopicSkillOverview(id);

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-8 px-6 py-10 md:px-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400">
            ← All topics
          </Link>
          <h1 className="font-display mt-2 text-3xl font-bold text-accent-600 dark:text-accent-400">
            {topic.name}
          </h1>
        </div>
        <TopicDeleteButton topicId={topic.id} topicName={topic.name} />
      </div>

      <nav className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PRACTICE_MODES.map(({ mode, icon: Icon, bg, text }) => (
          <Link
            key={mode}
            href={`/topics/${topic.id}/practice/${mode}`}
            className={`flex flex-col items-center gap-2 rounded-lg py-7 text-sm font-bold capitalize transition-colors ${bg} ${text}`}
          >
            <Icon className="h-5 w-5" />
            {mode}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-3 text-2xl font-black text-accent-600 dark:text-accent-400">Your skill</h2>
        <div className="flex flex-col gap-4">
          <SkillSummary summary={summary} />
          <SkillTable words={words} />
        </div>
      </section>

      <BankView bankItems={bankItems} />
    </main>
  );
}
