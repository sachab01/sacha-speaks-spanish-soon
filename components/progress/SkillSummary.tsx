import type { SkillSummary as SkillSummaryData } from "@/lib/db/progress";

export function SkillSummary({ summary }: { summary: SkillSummaryData }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg bg-ink p-5 text-[var(--background)]">
        <p className="text-sm font-bold text-[var(--background)]/70">Words tracked</p>
        <p className="text-4xl font-black">{summary.wordCount}</p>
      </div>
      <div className="rounded-lg bg-accent-600 p-5 text-[var(--background)]">
        <p className="text-sm font-bold text-[var(--background)]/70">Writing</p>
        <p className="text-4xl font-black">{summary.averageSkill.writing}%</p>
      </div>
      <div className="rounded-lg bg-blue p-5 text-[var(--background)]">
        <p className="text-sm font-bold text-[var(--background)]/70">Speaking</p>
        <p className="text-4xl font-black">{summary.averageSkill.speaking}%</p>
      </div>
      <div className="rounded-lg bg-mustard p-5 text-ink">
        <p className="text-sm font-bold text-ink/70">Listening</p>
        <p className="text-4xl font-black">{summary.averageSkill.listening}%</p>
      </div>
    </div>
  );
}
