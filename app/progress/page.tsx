import Link from "next/link";

import { SkillSummary } from "@/components/progress/SkillSummary";
import { SkillTable } from "@/components/progress/SkillTable";
import { getOverallSkillOverview } from "@/lib/db/progress";

// Skill decays continuously with time since last review, so this must never be statically cached.
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { summary, words } = await getOverallSkillOverview();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← All topics
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Your skill overview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live recall estimates from spaced repetition — these rise when you practice well and fade over time
          without review, across every topic.
        </p>
      </div>

      <SkillSummary summary={summary} />
      <SkillTable words={words} />
    </main>
  );
}
