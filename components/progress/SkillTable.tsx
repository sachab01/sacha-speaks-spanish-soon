import type { WordSkill } from "@/lib/db/progress";

function skillColor(value: number): string {
  if (value === 0) return "text-neutral-400";
  if (value < 40) return "text-red-600";
  if (value < 70) return "text-amber-600";
  return "text-green-600";
}

export function SkillTable({ words }: { words: WordSkill[] }) {
  if (words.length === 0) {
    return <p className="text-sm text-neutral-500">No words tracked yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs tracking-wide text-neutral-500 uppercase dark:border-neutral-800">
            <th className="py-2 pr-2">Word / sentence</th>
            <th className="px-2 py-2 text-right">Writing</th>
            <th className="px-2 py-2 text-right">Speaking</th>
            <th className="px-2 py-2 text-right">Listening</th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <tr key={word.vocabItemId} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2 pr-2">
                <span className="font-medium">{word.spanish}</span>
                <span className="text-neutral-500"> — {word.english}</span>
              </td>
              <td className={`px-2 py-2 text-right tabular-nums ${skillColor(word.skill.writing)}`}>
                {word.skill.writing}%
              </td>
              <td className={`px-2 py-2 text-right tabular-nums ${skillColor(word.skill.speaking)}`}>
                {word.skill.speaking}%
              </td>
              <td className={`px-2 py-2 text-right tabular-nums ${skillColor(word.skill.listening)}`}>
                {word.skill.listening}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
