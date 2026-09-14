"use client";

import { useState, type FormEvent } from "react";

import { CloseIcon, MessageIcon, MicIcon } from "@/components/ui/icons";
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
    <div className="qna-overlay fixed right-4 bottom-4 z-10">
      {isOpen ? (
        <div className="flex w-80 flex-col gap-3 rounded-lg border border-accent-200 bg-[var(--background)] p-4 shadow-lg dark:border-accent-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-accent-600 dark:text-accent-400">Ask a question</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-accent-500 hover:text-accent-700 dark:hover:text-accent-300"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {answer && (
            <div className="flex flex-col gap-1 rounded-md bg-accent-50 p-3 text-sm font-bold text-accent-700 dark:bg-accent-950/30 dark:text-accent-300">
              <p className="flex items-start gap-2">
                <span>{answer.answerText}</span>
                <button
                  type="button"
                  onClick={() => speak(answer.answerText, "en-US")}
                  aria-label="Listen to the answer"
                  className="shrink-0 text-accent-500 hover:text-accent-700 dark:hover:text-accent-300"
                >
                  🔊
                </button>
              </p>
              {!answer.onTopic && (
                <p className="text-xs font-bold text-accent-500">Let&rsquo;s get back to the exercise!</p>
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
              className="w-full rounded-full border border-accent-300 px-4 py-2 text-sm font-bold text-accent-600 outline-accent-500 focus:border-accent-500 dark:border-accent-800"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !questionText.trim()}
                className="flex-1 rounded-full bg-accent-600 px-3 py-1.5 text-sm font-bold text-[var(--background)] transition-colors hover:bg-accent-700 disabled:opacity-50"
              >
                {isSubmitting ? "Asking…" : "Ask"}
              </button>
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isSubmitting}
                className={
                  isRecording
                    ? "rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-[var(--background)]"
                    : "rounded-full bg-accent-600 px-3 py-1.5 text-sm font-bold text-[var(--background)] hover:bg-accent-700"
                }
              >
                {isRecording ? "Stop" : <MicIcon className="mx-auto h-4 w-4" />}
              </button>
            </div>
          </form>
          {(error || micError) && <p className="text-xs font-bold text-red-600">{error ?? micError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full bg-accent-600 px-4 py-3 text-sm font-bold text-[var(--background)] shadow-lg transition-colors hover:bg-accent-700"
        >
          <MessageIcon className="h-4 w-4" />
          Ask
        </button>
      )}
    </div>
  );
}
