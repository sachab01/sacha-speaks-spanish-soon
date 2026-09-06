import type { SkillSummary as SkillSummaryData } from "@/lib/db/progress";

export function SkillSummary({ summary }: { summary: SkillSummaryData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Words tracked</p>
        <p className="text-xl font-semibold">{summary.wordCount}</p>
      </div>
      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Writing</p>
        <p className="text-xl font-semibold">{summary.averageSkill.writing}%</p>
      </div>
      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Speaking</p>
        <p className="text-xl font-semibold">{summary.averageSkill.speaking}%</p>
      </div>
      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Listening</p>
        <p className="text-xl font-semibold">{summary.averageSkill.listening}%</p>
      </div>
    </div>
  );
}
