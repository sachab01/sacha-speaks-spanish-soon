import type { CoverageStats } from "@/lib/practiceStats";

const VARIANT_CLASSES = {
  /** For solid accent/blue cards (cream text/fill). */
  cream: { track: "bg-[var(--background)]/25", fill: "bg-[var(--background)]", text: "text-[var(--background)]" },
  /** For solid mustard cards (near-black text/fill, matching the mustard-contrast rule used elsewhere). */
  ink: { track: "bg-ink/20", fill: "bg-ink", text: "text-ink" },
  /** For plain cream/dark backgrounds (accent-colored fill). */
  default: { track: "bg-accent-100 dark:bg-accent-900", fill: "bg-accent-600 dark:bg-accent-400", text: "" },
} as const;

export function CoverageBar({
  label,
  stats,
  variant = "default",
}: {
  label: string;
  stats: CoverageStats;
  variant?: keyof typeof VARIANT_CLASSES;
}) {
  const { practicedCount, totalCount, meanScore } = stats;
  const percent = totalCount > 0 ? Math.round((practicedCount / totalCount) * 100) : 0;
  const { track, fill, text } = VARIANT_CLASSES[variant];

  return (
    <div className={`flex flex-col gap-1 ${text}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span>{label}</span>
        <span>
          {practicedCount}/{totalCount}
          {meanScore !== null && ` · ${meanScore}% avg`}
        </span>
      </div>
      <div className={`h-2 w-full overflow-hidden rounded-full ${track}`}>
        <div className={`h-full rounded-full transition-[width] ${fill}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
