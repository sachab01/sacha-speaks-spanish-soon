import type { ReactNode } from "react";

export function FeedbackCard({
  correct,
  feedbackEn,
  correctAnswer,
  extra,
  onNext,
}: {
  correct: boolean;
  feedbackEn: string;
  correctAnswer: string;
  extra?: ReactNode;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <p className={correct ? "text-sm font-medium text-green-600" : "text-sm font-medium text-amber-600"}>
        {correct ? "Correct" : "Not quite"}
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{feedbackEn}</p>
      <p className="text-sm">
        <span className="text-neutral-500">Correct answer: </span>
        <span className="font-medium">{correctAnswer}</span>
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
