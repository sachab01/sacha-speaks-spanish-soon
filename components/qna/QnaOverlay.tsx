"use client";

import { useState, type FormEvent } from "react";

import { useMicRecorder } from "@/hooks/useMicRecorder";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

type QnaAnswer = {
  answerText: string;
  onTopic: boolean;
  newVocabAdded: { spanish: string; english: string }[];
};

/**
 * Floating ask-a-question panel, mounted for the lifetime of an exercise.
 * Submitting doesn't touch the exercise's own state — it's purely a side
 * conversation scoped to the current attempt.
 */
export function QnaOverlay({ qnaUrl, attemptId }: { qnaUrl: string; attemptId: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QnaAnswer | null>(null);
  const { isRecording, error: micError, start, stop } = useMicRecorder();
  const { speak } = useSpeechSynthesis();

  async function submit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await fetch(qnaUrl, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to get an answer");
      setAnswer(data);
      speak(data.answerText, "en-US");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTextSubmit(event: FormEvent) {
    event.preventDefault();
    if (!questionText.trim() || !attemptId) return;
    const formData = new FormData();
    formData.append("attemptId", attemptId);
    formData.append("questionText", questionText.trim());
    void submit(formData);
    setQuestionText("");
  }

  async function handleMicToggle() {
    if (isRecording) {
      const blob = await stop();
      if (blob && attemptId) {
        const formData = new FormData();
        formData.append("attemptId", attemptId);
        formData.append("questionAudio", blob, "question.webm");
        void submit(formData);
      }
    } else {
      await start();
    }
  }

  if (!attemptId) return null;

  return (
    <div className="fixed right-4 bottom-4 z-10">
      {isOpen ? (
        <div className="flex w-80 flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ask a question</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ✕
            </button>
          </div>

          {answer && (
            <div className="flex flex-col gap-1 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
              <p>{answer.answerText}</p>
              {!answer.onTopic && (
                <p className="text-xs text-neutral-500">Let&rsquo;s get back to the exercise!</p>
              )}
              {answer.newVocabAdded.length > 0 && (
                <p className="text-xs text-green-600">
                  Added: {answer.newVocabAdded.map((v) => `${v.spanish} (${v.english})`).join(", ")}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleTextSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="Type a question…"
              disabled={isSubmitting}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !questionText.trim()}
                className="flex-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {isSubmitting ? "Asking…" : "Ask"}
              </button>
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isSubmitting}
                className={
                  isRecording
                    ? "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                }
              >
                {isRecording ? "Stop" : "🎤"}
              </button>
            </div>
          </form>
          {(error || micError) && <p className="text-xs text-red-600">{error ?? micError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          ? Ask
        </button>
      )}
    </div>
  );
}
