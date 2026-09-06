"use client";

import { Fragment, useEffect, useRef } from "react";

import { QnaOverlay } from "@/components/qna/QnaOverlay";
import { useMicRecorder } from "@/hooks/useMicRecorder";
import {
  qnaPath,
  usePracticeSession,
  type PracticeFocus,
  type PracticeScope,
} from "@/hooks/usePracticeSession";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { FeedbackCard } from "./FeedbackCard";

export function SpeakingExercise({ scope, focus = "due" }: { scope: PracticeScope; focus?: PracticeFocus }) {
  const { prompt, result, isLoading, isSubmitting, error, submitAudio, next } = usePracticeSession(
    scope,
    "speaking",
    focus,
  );
  const { isRecording, error: micError, start, stop } = useMicRecorder();
  const { speak } = useSpeechSynthesis();
  const spokenForAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!result || !prompt) return;
    if (spokenForAttemptRef.current === prompt.attemptId) return;
    spokenForAttemptRef.current = prompt.attemptId;

    // Always speak the correct Spanish sentence, win or lose, so the learner
    // hears a correct pronunciation model. Feedback text isn't auto-spoken —
    // an unprompted voice reading out grading feedback right after recording
    // felt jarring; it's still available via the "Replay feedback" button.
    speak(result.correctAnswerEs ?? "", "es-MX");
  }, [result, prompt, speak]);

  async function handleToggleRecording() {
    if (isRecording) {
      const blob = await stop();
      if (blob) submitAudio(blob);
    } else {
      await start();
    }
  }

  function handleNext() {
    spokenForAttemptRef.current = null;
    next();
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error && !prompt) return <p className="text-sm text-red-600">{error}</p>;
  if (!prompt) return null;

  return (
    <Fragment>
      <QnaOverlay qnaUrl={qnaPath(scope, "speaking")} attemptId={prompt.attemptId} />
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs tracking-wide text-neutral-500 uppercase">Say this in Spanish</p>
          <p className="mt-1 text-lg font-medium">{prompt.promptEnglish}</p>
        </div>

        {!result ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={isSubmitting}
              className={
                isRecording
                  ? "self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
                  : "self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              }
            >
              {isSubmitting ? "Grading…" : isRecording ? "Stop recording" : "Start recording"}
            </button>
            {(error || micError) && <p className="text-sm text-red-600">{error ?? micError}</p>}
          </div>
        ) : (
          <FeedbackCard
            correct={result.correct}
            feedbackEn={result.feedbackEn}
            userAnswer={result.transcript ?? ""}
            userAnswerLabel="We heard"
            correctAnswer={result.correctAnswerEs ?? ""}
            words={result.words}
            onNext={handleNext}
            extra={
              <div className="flex flex-col gap-1 text-sm">
                {typeof result.pronunciationScore === "number" && (
                  <p className="text-neutral-500">Pronunciation score: {result.pronunciationScore}/100</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => speak(result.feedbackEn, "en-US")}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    🔊 Replay feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => speak(result.correctAnswerEs ?? "", "es-MX")}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    🔊 Replay Spanish
                  </button>
                </div>
              </div>
            }
          />
        )}
      </div>
    </Fragment>
  );
}
