import type { SkillCell, WordSkill } from "@/lib/db/progress";

function skillColor(value: number): string {
  if (value < 40) return "text-red-600";
  if (value < 70) return "text-amber-600";
  return "text-green-600";
}

function SkillCellValue({ cell }: { cell: SkillCell }) {
  if (!cell.practiced) return <span className="font-bold text-neutral-400">not covered</span>;
  return <span className={`font-bold ${skillColor(cell.score)}`}>{cell.score}%</span>;
}

export function SkillTable({ words }: { words: WordSkill[] }) {
  if (words.length === 0) {
    return <p className="text-sm font-bold text-accent-600 dark:text-accent-400">No words tracked yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-accent-100 dark:border-accent-900">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-accent-100 bg-accent-50/50 text-left text-xs font-black tracking-wide text-accent-600 uppercase dark:border-accent-900 dark:bg-accent-950/20 dark:text-accent-400">
            <th className="py-3 pr-2 pl-4">Word / sentence</th>
            <th className="px-2 py-3 text-right">Writing</th>
            <th className="px-2 py-3 text-right">Speaking</th>
            <th className="px-2 py-3 text-right">Listening</th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <tr
              key={word.vocabItemId}
              className="border-b border-accent-50 last:border-b-0 dark:border-accent-950"
            >
              <td className="py-3 pr-2 pl-4">
                <span className="font-bold">{word.spanish}</span>
                <span className="font-bold text-accent-500 dark:text-accent-500"> — {word.english}</span>
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                <SkillCellValue cell={word.skill.writing} />
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                <SkillCellValue cell={word.skill.speaking} />
              </td>
              <td className="px-2 py-3 text-right tabular-nums">
                <SkillCellValue cell={word.skill.listening} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
