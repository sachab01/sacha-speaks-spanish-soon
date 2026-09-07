"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";

import { QnaOverlay } from "@/components/qna/QnaOverlay";
import {
  qnaPath,
  usePracticeSession,
  type AttemptResult,
  type PracticeFocus,
  type PracticeScope,
} from "@/hooks/usePracticeSession";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { FeedbackCard } from "./FeedbackCard";

export function ListeningExercise({
  scope,
  focus = "due",
  onResult,
}: {
  scope: PracticeScope;
  focus?: PracticeFocus;
  /** Fired with each graded attempt — e.g. for a wrapper that tallies session-only coverage stats. */
  onResult?: (result: AttemptResult) => void;
}) {
  const { prompt, result, isLoading, isSubmitting, error, submitText, next } = usePracticeSession(
    scope,
    "listening",
    focus,
    onResult,
  );
  const { speak, pause, resume } = useSpeechSynthesis();
  const [answer, setAnswer] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const spokenForAttemptRef = useRef<string | null>(null);

  // Browser TTS has no real seekable audio timeline — "seeking" means
  // re-synthesizing from a substring, offsetting boundary-event positions by
  // where we started so the progress bar keeps tracking the whole sentence.
  function playFrom(startChar: number) {
    const fullText = prompt?.promptSpanish ?? "";
    if (!fullText) return;
    setIsPaused(false);
    speak(fullText.slice(startChar), "es-MX", {
      onBoundary: (charIndex) => setProgress((startChar + charIndex) / fullText.length),
      onEnd: () => setProgress(1),
    });
  }

  function handlePlaySentence() {
    setProgress(0);
    playFrom(0);
  }

  function handlePauseResume() {
    if (isPaused) {
      resume();
      setIsPaused(false);
    } else {
      pause();
      setIsPaused(true);
    }
  }

  function handleSeek(event: React.MouseEvent<HTMLDivElement>) {
    const fullText = prompt?.promptSpanish ?? "";
    if (!fullText) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setProgress(fraction);
    playFrom(Math.round(fraction * fullText.length));
  }

  useEffect(() => {
    if (!prompt || result) return;
    if (spokenForAttemptRef.current === prompt.attemptId) return;
    spokenForAttemptRef.current = prompt.attemptId;
    const fullText = prompt.promptSpanish ?? "";
    setProgress(0);
    setIsPaused(false);
    speak(fullText, "es-MX", {
      onBoundary: (charIndex) => setProgress(charIndex / fullText.length),
      onEnd: () => setProgress(1),
    });
    // Stop playback if the learner navigates away mid-sentence (e.g. clicking
    // "Next" or leaving the page) — otherwise it keeps speaking in the background.
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [prompt, result, speak]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitText(answer);
  }

  function handleNext() {
    setAnswer("");
    setProgress(0);
    setIsPaused(false);
    spokenForAttemptRef.current = null;
    next();
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error && !prompt) return <p className="text-sm text-red-600">{error}</p>;
  if (!prompt) return null;

  return (
    <Fragment>
      <QnaOverlay qnaUrl={qnaPath(scope, "listening")} attemptId={prompt.attemptId} />
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs tracking-wide text-neutral-500 uppercase">Listen and translate to English</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePlaySentence}
              className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:border-neutral-500 dark:border-neutral-700"
            >
              🔊 Play sentence
            </button>
            <button
              type="button"
              onClick={handlePauseResume}
              className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:border-neutral-500 dark:border-neutral-700"
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>
          {!result && (
            <div
              onClick={handleSeek}
              role="slider"
              aria-label="Seek within the sentence"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-2 w-full cursor-pointer overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
            >
              <div
                className="h-full rounded-full bg-neutral-900 transition-[width] dark:bg-neutral-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
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
            userAnswer={answer}
            correctAnswer={result.correctAnswerEn ?? ""}
            words={result.words}
            onNext={handleNext}
            extra={
              <p className="text-sm text-neutral-500">
                Spanish:{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {result.correctAnswerEs}
                </span>
              </p>
            }
          />
        )}
      </div>
    </Fragment>
  );
}
