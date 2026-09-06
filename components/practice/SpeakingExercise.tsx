"use client";

import { useEffect, useRef } from "react";

import { useMicRecorder } from "@/hooks/useMicRecorder";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { FeedbackCard } from "./FeedbackCard";

export function SpeakingExercise({ topicId }: { topicId: number }) {
  const { prompt, result, isLoading, isSubmitting, error, submitAudio, next } = usePracticeSession(
    topicId,
    "speaking",
  );
  const { isRecording, error: micError, start, stop } = useMicRecorder();
  const { speak } = useSpeechSynthesis();
  const spokenForAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!result || !prompt) return;
    if (spokenForAttemptRef.current === prompt.attemptId) return;
    spokenForAttemptRef.current = prompt.attemptId;

    // Always speak the correct Spanish sentence, win or lose, so the learner
    // hears a correct pronunciation model; feedback plays first, in English.
    speak(result.feedbackEn, "en-US");
    window.setTimeout(() => speak(result.correctAnswerEs ?? "", "es-ES"), 3500);
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
          correctAnswer={result.correctAnswerEs ?? ""}
          onNext={handleNext}
          extra={
            <div className="flex flex-col gap-1 text-sm">
              {typeof result.pronunciationScore === "number" && (
                <p className="text-neutral-500">Pronunciation score: {result.pronunciationScore}/100</p>
              )}
              {result.transcript && <p className="text-neutral-500">We heard: &ldquo;{result.transcript}&rdquo;</p>}
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
                  onClick={() => speak(result.correctAnswerEs ?? "", "es-ES")}
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
  );
}
