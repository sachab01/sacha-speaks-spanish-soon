import type { ReactNode } from "react";

import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

export function FeedbackCard({
  correct,
  feedbackEn,
  correctAnswer,
  spanishToSpeak,
  extra,
  onNext,
}: {
  correct: boolean;
  feedbackEn: string;
  correctAnswer: string;
  /** When given, shows a button to hear this text spoken in Mexican Spanish. */
  spanishToSpeak?: string;
  extra?: ReactNode;
  onNext: () => void;
}) {
  const { speak } = useSpeechSynthesis();

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <p className={correct ? "text-sm font-medium text-green-600" : "text-sm font-medium text-amber-600"}>
        {correct ? "Correct" : "Not quite"}
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{feedbackEn}</p>
      <p className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Correct answer: </span>
        <span className="font-medium">{correctAnswer}</span>
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
