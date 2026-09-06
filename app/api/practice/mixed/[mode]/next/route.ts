import { NextResponse } from "next/server";

import { errorResponse, parsePracticeMode } from "@/lib/api-utils";
import { getNextMixedPracticeItem } from "@/lib/db/practice";

export async function GET(_request: Request, { params }: { params: Promise<{ mode: string }> }) {
  const { mode: modeParam } = await params;
  const mode = parsePracticeMode(modeParam);
  if (!mode) {
    return NextResponse.json({ error: "Invalid practice mode" }, { status: 400 });
  }

  try {
    const attempt = await getNextMixedPracticeItem(mode);

    if (mode === "listening") {
      return NextResponse.json({ attemptId: attempt.id, promptSpanish: attempt.generatedSpanish });
    }
    return NextResponse.json({ attemptId: attempt.id, promptEnglish: attempt.generatedEnglish });
  } catch (error) {
    return errorResponse(error);
  }
}
