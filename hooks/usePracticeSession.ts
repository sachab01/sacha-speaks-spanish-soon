"use client";

import { useCallback, useEffect, useState } from "react";

export type PracticeMode = "writing" | "speaking" | "listening";

type Prompt = { attemptId: string; promptEnglish?: string; promptSpanish?: string };

export type AttemptResult = {
  correct: boolean;
  feedbackEn: string;
  correctAnswerEs?: string;
  correctAnswerEn?: string;
  transcript?: string;
  pronunciationScore?: number;
};

async function parseJsonResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Something went wrong");
  }
  return data;
}

/** Shared attempt lifecycle (fetch prompt, submit, grade, advance) for all three practice modes. */
export function usePracticeSession(topicId: number, mode: PracticeMode) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setPrompt(null);
    try {
      const response = await fetch(`/api/topics/${topicId}/practice/${mode}/next`);
      setPrompt(await parseJsonResponse(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [topicId, mode]);

  useEffect(() => {
    // Deferred to a microtask so state updates inside fetchNext don't happen
    // synchronously within the effect body itself (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      fetchNext();
    });
  }, [fetchNext]);

  const submitText = useCallback(
    async (userAnswerText: string) => {
      if (!prompt) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`/api/topics/${topicId}/practice/${mode}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: prompt.attemptId, userAnswerText }),
        });
        setResult(await parseJsonResponse(response));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSubmitting(false);
      }
    },
    [topicId, mode, prompt],
  );

  const submitAudio = useCallback(
    async (blob: Blob) => {
      if (!prompt) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("attemptId", prompt.attemptId);
        formData.append("audio", blob, "recording.webm");
        const response = await fetch(`/api/topics/${topicId}/practice/${mode}/attempt`, {
          method: "POST",
          body: formData,
        });
        setResult(await parseJsonResponse(response));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSubmitting(false);
      }
    },
    [topicId, mode, prompt],
  );

  return { prompt, result, isLoading, isSubmitting, error, submitText, submitAudio, next: fetchNext };
}
