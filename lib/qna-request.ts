import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AttemptIdSchema = z.string().uuid();

type ParsedQna = {
  attemptId: string;
  question: { text: string } | { audioBytes: { data: Buffer; mimeType: string } };
};

/** Parses and validates the multipart body shared by both Q&A routes. */
export async function parseQnaFormData(request: Request): Promise<ParsedQna | NextResponse> {
  const formData = await request.formData();
  const attemptId = formData.get("attemptId");
  const questionText = formData.get("questionText");
  const questionAudio = formData.get("questionAudio");

  if (typeof attemptId !== "string" || !AttemptIdSchema.safeParse(attemptId).success) {
    return NextResponse.json({ error: "Invalid or missing attemptId" }, { status: 400 });
  }

  const hasText = typeof questionText === "string" && questionText.trim().length > 0;
  const hasAudio = questionAudio instanceof Blob && questionAudio.size > 0;

  if (!hasText && !hasAudio) {
    return NextResponse.json({ error: "Provide a question, as text or audio" }, { status: 400 });
  }
  if (hasAudio && (questionAudio as Blob).size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio recording is too large" }, { status: 400 });
  }

  const question = hasText
    ? { text: (questionText as string).trim() }
    : {
        audioBytes: {
          data: Buffer.from(await (questionAudio as Blob).arrayBuffer()),
          mimeType: (questionAudio as Blob).type || "audio/webm",
        },
      };

  return { attemptId, question };
}
