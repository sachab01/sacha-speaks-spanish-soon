import type { ReactNode } from "react";

import type { WordVerdict } from "@/hooks/usePracticeSession";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

type Span = { text: string; verdict?: WordVerdict["verdict"]; note?: string | null };

/**
 * Locates each non-"correct" verdict's `sentenceText` inside the displayed
 * sentence (first occurrence, sorted left-to-right, non-overlapping) so it
 * can be highlighted inline rather than only listed separately below. A verdict
 * whose sentenceText can't be found (best-effort — the model doesn't always
 * echo an exact substring) is simply skipped, not shown as a broken span.
 */
function buildHighlightedSpans(sentence: string, words: WordVerdict[]): Span[] {
  const lowerSentence = sentence.toLowerCase();
  const located = words
    .filter((w) => w.verdict !== "correct" && w.sentenceText)
    .map((w) => ({ word: w, index: lowerSentence.indexOf(w.sentenceText.toLowerCase()) }))
    .filter((w) => w.index !== -1)
    .sort((a, b) => a.index - b.index);

  const spans: Span[] = [];
  let cursor = 0;
  for (const { word, index } of located) {
    if (index < cursor) continue;
    if (index > cursor) spans.push({ text: sentence.slice(cursor, index) });
    spans.push({ text: sentence.slice(index, index + word.sentenceText.length), verdict: word.verdict, note: word.note });
    cursor = index + word.sentenceText.length;
  }
  if (cursor < sentence.length) spans.push({ text: sentence.slice(cursor) });
  return spans;
}

function verdictHighlightClass(verdict: WordVerdict["verdict"]): string {
  return verdict === "acceptable"
    ? "rounded bg-blue-100 px-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
    : "rounded bg-red-100 px-0.5 text-red-800 dark:bg-red-950 dark:text-red-300";
}

/**
 * Short icon + text color per verdict, so the notes list is scannable at a
 * glance and not color-only (color alone isn't reliable here — the solid-color
 * practice card skins flatten these text colors to a single tone, see
 * app/globals.css's `.practice-card-cream`/`.practice-card-ink` overrides).
 * A "wrong" verdict gets its own icon when `minorMistake` is set — a spelling
 * slip or recognizable near-miss reads very differently from a genuinely
 * wrong word, and shouldn't look identical in the list.
 */
function verdictStyle(word: WordVerdict): { icon: string; textClass: string } {
  switch (word.verdict) {
    case "acceptable":
      return { icon: "≈", textClass: "text-blue-600 dark:text-blue-400" };
    case "missing":
      return { icon: "∅", textClass: "text-red-600 dark:text-red-400" };
    default:
      return word.minorMistake
        ? { icon: "±", textClass: "text-amber-600 dark:text-amber-400" }
        : { icon: "✗", textClass: "text-red-600 dark:text-red-400" };
  }
}

function HighlightedSentence({ sentence, words }: { sentence: string; words?: WordVerdict[] }) {
  if (!words || words.length === 0) return <>{sentence}</>;
  return (
    <>
      {buildHighlightedSpans(sentence, words).map((span, i) =>
        span.verdict ? (
          <span key={i} className={verdictHighlightClass(span.verdict)} title={span.note ?? undefined}>
            {span.text}
          </span>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}

export function FeedbackCard({
  correct,
  feedbackEn,
  userAnswer,
  userAnswerLabel = "You wrote",
  correctAnswer,
  words,
  spanishToSpeak,
  gradedBy,
  graderWarning,
  extra,
  onNext,
}: {
  correct: boolean;
  feedbackEn: string;
  userAnswer: string;
  /** Label for the userAnswer row, e.g. "You said" for speaking. Defaults to "You wrote". */
  userAnswerLabel?: string;
  correctAnswer: string;
  /** Per-word breakdown — non-"correct" entries are highlighted inline in the sentence and listed below. */
  words?: WordVerdict[];
  /** When given, shows a button to hear this text spoken in Mexican Spanish. */
  spanishToSpeak?: string;
  /** Which model graded this attempt. A warning banner only shows when this is "mistral" (the Gemini fallback fired). */
  gradedBy?: "gemini" | "mistral";
  graderWarning?: string | null;
  extra?: ReactNode;
  onNext: () => void;
}) {
  const { speak } = useSpeechSynthesis();
  const notableWords = words?.filter((w) => w.verdict !== "correct") ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      {gradedBy === "mistral" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          ⚠️ {graderWarning ?? "Gemini was unavailable — this was graded with a backup model and may be less accurate."}
        </p>
      )}
      <p className={correct ? "text-sm font-medium text-green-600" : "text-sm font-medium text-amber-600"}>
        {correct ? "Correct" : "Not quite"}
      </p>
      <p className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">{userAnswerLabel}: </span>
        <span className="font-medium">{userAnswer || "(blank)"}</span>
      </p>
      <p className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Correct answer: </span>
        <span className="font-medium">
          <HighlightedSentence sentence={correctAnswer} words={words} />
        </span>
        {spanishToSpeak && (
          <button
            type="button"
            onClick={() => speak(spanishToSpeak, "es-MX")}
            aria-label="Listen to pronunciation"
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            🔊
          </button>
        )}
      </p>
      {notableWords.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {notableWords.map((word, i) => {
            const { icon, textClass } = verdictStyle(word);
            return (
              <li key={i} className="flex flex-col gap-0.5">
                <div className={`flex flex-wrap items-baseline gap-x-1.5 font-medium ${textClass}`}>
                  <span aria-hidden="true">{icon}</span>
                  <span>{word.vocabWord ?? word.sentenceText}</span>
                  {word.userSaid && (
                    <span className="font-normal text-neutral-500">
                      — you wrote &ldquo;{word.userSaid}&rdquo;
                    </span>
                  )}
                </div>
                {word.note && <p className="pl-4 text-xs text-neutral-500 dark:text-neutral-400">{word.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{feedbackEn}</p>
      {extra}
      <button
        type="button"
        onClick={onNext}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Next
      </button>
    </div>
  );
}
