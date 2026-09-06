import { NextResponse } from "next/server";

import { errorResponse, parsePracticeMode } from "@/lib/api-utils";
import { getNextPracticeItem } from "@/lib/db/practice";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string; mode: string }> },
) {
  const { topicId: topicIdParam, mode: modeParam } = await params;

  const topicId = Number(topicIdParam);
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }

  const mode = parsePracticeMode(modeParam);
  if (!mode) {
    return NextResponse.json({ error: "Invalid practice mode" }, { status: 400 });
  }

  try {
    const attempt = await getNextPracticeItem(topicId, mode);

    if (mode === "listening") {
      return NextResponse.json({ attemptId: attempt.id, promptSpanish: attempt.generatedSpanish });
    }
    return NextResponse.json({ attemptId: attempt.id, promptEnglish: attempt.generatedEnglish });
  } catch (error) {
    return errorResponse(error);
  }
}
