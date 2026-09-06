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
  extra?: ReactNode;
  onNext: () => void;
}) {
  const { speak } = useSpeechSynthesis();
  const notableWords = words?.filter((w) => w.verdict !== "correct") ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
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
        <ul className="flex flex-col gap-1 text-sm">
          {notableWords.map((word, i) => (
            <li
              key={i}
              className={word.verdict === "acceptable" ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}
            >
              <span className="font-medium">{word.vocabWord ?? word.sentenceText}</span>
              {word.userSaid && <span> — you said &ldquo;{word.userSaid}&rdquo;</span>}
              {word.note && <span>: {word.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{feedbackEn}</p>
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
