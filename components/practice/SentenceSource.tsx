import { madeByWeakerFallback, sentenceSourceLabel, type SentenceOrigin } from "@/lib/sentenceSource";

/**
 * Which model(s) made a sentence, shown wherever a generated sentence
 * appears — with a warning when the weaker fallback model was involved.
 */
export function SentenceSource({
  origin,
  className = "text-xs opacity-70",
}: {
  origin: SentenceOrigin;
  className?: string;
}) {
  const label = `Sentence by ${sentenceSourceLabel(origin) ?? "an unknown model"}`;
  if (!madeByWeakerFallback(origin)) return <p className={className}>{label}</p>;

  return (
    <p className={`${className} font-bold text-red-600 opacity-100 dark:text-red-400`}>
      ⚠ {label} — the better models were unavailable, so this sentence may be less natural or correct.
    </p>
  );
}
