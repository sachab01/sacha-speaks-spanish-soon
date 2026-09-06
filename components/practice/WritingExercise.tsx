"use client";

import { Fragment, useState, type FormEvent } from "react";

import { QnaOverlay } from "@/components/qna/QnaOverlay";
import {
  qnaPath,
  usePracticeSession,
  type PracticeFocus,
  type PracticeScope,
} from "@/hooks/usePracticeSession";
import { FeedbackCard } from "./FeedbackCard";

export function WritingExercise({ scope, focus = "due" }: { scope: PracticeScope; focus?: PracticeFocus }) {
  const { prompt, result, isLoading, isSubmitting, error, submitText, next } = usePracticeSession(
    scope,
    "writing",
    focus,
  );
  const [answer, setAnswer] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitText(answer);
  }

  function handleNext() {
    setAnswer("");
    next();
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error && !prompt) return <p className="text-sm text-red-600">{error}</p>;
  if (!prompt) return null;

  return (
    <Fragment>
      <QnaOverlay qnaUrl={qnaPath(scope, "writing")} attemptId={prompt.attemptId} />
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs tracking-wide text-neutral-500 uppercase">Translate to Spanish</p>
          <p className="mt-1 text-lg font-medium">{prompt.promptEnglish}</p>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={isSubmitting}
              autoFocus
              placeholder="Escribe tu respuesta…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {isSubmitting ? "Checking…" : "Check"}
            </button>
          </form>
        ) : (
          <FeedbackCard
            correct={result.correct}
            feedbackEn={result.feedbackEn}
            userAnswer={answer}
            correctAnswer={result.correctAnswerEs ?? ""}
            words={result.words}
            spanishToSpeak={result.correctAnswerEs}
            onNext={handleNext}
          />
        )}
      </div>
    </Fragment>
  );
}
