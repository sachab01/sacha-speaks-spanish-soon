import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api-utils";
import { askQuestion } from "@/lib/db/qna";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AttemptIdSchema = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }

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

  try {
    const question = hasText
      ? { text: (questionText as string).trim() }
      : {
          audioBytes: {
            data: Buffer.from(await (questionAudio as Blob).arrayBuffer()),
            mimeType: (questionAudio as Blob).type || "audio/webm",
          },
        };

    const result = await askQuestion({ topicId, attemptId, question });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
