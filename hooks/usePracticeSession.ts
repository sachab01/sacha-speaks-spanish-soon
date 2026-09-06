"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PracticeMode = "writing" | "speaking" | "listening";
export type PracticeFocus = "due" | "weakest" | "stale";

/** Scopes a practice session to one topic, or to Mixed Review across all topics. */
export type PracticeScope = { topicId: number } | { mixed: true };

export function practiceBasePath(scope: PracticeScope, mode: PracticeMode) {
  return "topicId" in scope
    ? `/api/topics/${scope.topicId}/practice/${mode}`
    : `/api/practice/mixed/${mode}`;
}

export function qnaPath(scope: PracticeScope, mode: PracticeMode) {
  return "topicId" in scope ? `/api/topics/${scope.topicId}/qna` : `/api/practice/mixed/${mode}/qna`;
}

type Prompt = { attemptId: string; promptEnglish?: string; promptSpanish?: string };

export type WordVerdict = {
  /** Null when this span isn't one of the tracked vocab words (ordinary grammar/glue) — still graded, just not FSRS-scheduled. */
  vocabWord: string | null;
  /** The literal substring within the displayed sentence this verdict corresponds to — used for inline highlighting. */
  sentenceText: string;
  userSaid: string | null;
  verdict: "correct" | "acceptable" | "wrong" | "missing";
  note: string | null;
};

export type AttemptResult = {
  correct: boolean;
  feedbackEn: string;
  words?: WordVerdict[];
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
export function usePracticeSession(scope: PracticeScope, mode: PracticeMode, focus: PracticeFocus = "due") {
  const basePath = practiceBasePath(scope, mode);
  const nextUrl = focus === "due" ? `${basePath}/next` : `${basePath}/next?focus=${focus}`;
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against React Strict Mode's dev-only double effect invocation: /next
  // isn't idempotent (each call generates a fresh sentence), so two overlapping
  // calls can both resolve — only the latest one's result should ever be applied,
  // or a stale response could silently replace the prompt after the newer one.
  const requestIdRef = useRef(0);

  const fetchNext = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setPrompt(null);
    try {
      const response = await fetch(nextUrl);
      const data = await parseJsonResponse(response);
      if (requestIdRef.current === requestId) setPrompt(data);
    } catch (err) {
      if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [nextUrl]);

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
        const response = await fetch(`${basePath}/attempt`, {
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
    [basePath, prompt],
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
        const response = await fetch(`${basePath}/attempt`, { method: "POST", body: formData });
        setResult(await parseJsonResponse(response));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsSubmitting(false);
      }
    },
    [basePath, prompt],
  );

  return { prompt, result, isLoading, isSubmitting, error, submitText, submitAudio, next: fetchNext };
}
