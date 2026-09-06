import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, type PracticeMode } from "./api-utils";
import { submitSpeakingAttempt, submitTranslationAttempt } from "./db/practice";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const TranslationAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  userAnswerText: z.string().max(1000),
});

/**
 * Grades one practice attempt. Shared by the per-topic and Mixed Review
 * attempt routes — grading an attempt never needs to know which topic it
 * belongs to (the attempt row already carries that), so the same handler
 * serves both.
 */
export async function handlePracticeAttemptRequest(request: Request, mode: PracticeMode) {
  try {
    if (mode === "speaking") {
      const formData = await request.formData();
      const attemptId = formData.get("attemptId");
      const audio = formData.get("audio");

      if (typeof attemptId !== "string" || !z.string().uuid().safeParse(attemptId).success) {
        return NextResponse.json({ error: "Invalid or missing attemptId" }, { status: 400 });
      }
      if (!(audio instanceof Blob) || audio.size === 0) {
        return NextResponse.json({ error: "Missing audio recording" }, { status: 400 });
      }
      if (audio.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: "Audio recording is too large" }, { status: 400 });
      }

      const audioBytes = Buffer.from(await audio.arrayBuffer());
      const result = await submitSpeakingAttempt({
        attemptId,
        audioBytes,
        mimeType: audio.type || "audio/webm",
      });
      return NextResponse.json(result);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = TranslationAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const direction = mode === "writing" ? "en_to_es" : "es_to_en";
    const result = await submitTranslationAttempt({ ...parsed.data, direction });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
