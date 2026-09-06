"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { FeedbackCard } from "./FeedbackCard";

export function ListeningExercise({ topicId }: { topicId: number }) {
  const { prompt, result, isLoading, isSubmitting, error, submitText, next } = usePracticeSession(
    topicId,
    "listening",
  );
  const { speak } = useSpeechSynthesis();
  const [answer, setAnswer] = useState("");
  const spokenForAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prompt || result) return;
    if (spokenForAttemptRef.current === prompt.attemptId) return;
    spokenForAttemptRef.current = prompt.attemptId;
    speak(prompt.promptSpanish ?? "", "es-ES");
  }, [prompt, result, speak]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitText(answer);
  }

  function handleNext() {
    setAnswer("");
    spokenForAttemptRef.current = null;
    next();
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error && !prompt) return <p className="text-sm text-red-600">{error}</p>;
  if (!prompt) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs tracking-wide text-neutral-500 uppercase">Listen and translate to English</p>
        <button
          type="button"
          onClick={() => speak(prompt.promptSpanish ?? "", "es-ES")}
          className="mt-2 flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:border-neutral-500 dark:border-neutral-700"
        >
          🔊 Play sentence
        </button>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={isSubmitting}
            autoFocus
            placeholder="What did you hear? (in English)"
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
          correctAnswer={result.correctAnswerEn ?? ""}
          onNext={handleNext}
          extra={
            <p className="text-sm text-neutral-500">
              Spanish:{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{result.correctAnswerEs}</span>
            </p>
          }
        />
      )}
    </div>
  );
}
