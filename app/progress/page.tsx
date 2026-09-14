import Link from "next/link";

import { SkillSummary } from "@/components/progress/SkillSummary";
import { SkillTable } from "@/components/progress/SkillTable";
import { getOverallSkillOverview } from "@/lib/db/progress";

// Skill decays continuously with time since last review, so this must never be statically cached.
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { summary, words } = await getOverallSkillOverview();

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-8 px-6 py-10 md:px-12">
      <div>
        <Link href="/" className="text-sm font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400">
          ← All topics
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold text-accent-600 dark:text-accent-400">
          Your skill overview
        </h1>
        <p className="mt-1 text-sm font-bold text-accent-600 dark:text-accent-400">
          Live recall estimates from spaced repetition — these rise when you practice well and fade over time
          without review, across every topic.
        </p>
      </div>

      <div className="flex max-w-4xl flex-col gap-6">
        <SkillSummary summary={summary} />
        <section>
          <h2 className="mb-3 text-2xl font-black text-accent-600 dark:text-accent-400">All words</h2>
          <SkillTable words={words} />
        </section>
      </div>
    </main>
  );
}
