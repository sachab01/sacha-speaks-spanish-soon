import { NextResponse } from "next/server";

import { errorResponse, parseGenerateFlag, parsePracticeFocus, parsePracticeMode } from "@/lib/api-utils";
import { getNextMixedPracticeItem } from "@/lib/db/practice";

export async function GET(request: Request, { params }: { params: Promise<{ mode: string }> }) {
  const { mode: modeParam } = await params;
  const mode = parsePracticeMode(modeParam);
  if (!mode) {
    return NextResponse.json({ error: "Invalid practice mode" }, { status: 400 });
  }

  const focus = parsePracticeFocus(request);
  const generate = parseGenerateFlag(new URL(request.url).searchParams.get("generate"));

  try {
    const { attempt, notice } = await getNextMixedPracticeItem(mode, focus, generate);

    if (mode === "listening") {
      return NextResponse.json({ attemptId: attempt.id, promptSpanish: attempt.generatedSpanish, notice });
    }
    return NextResponse.json({ attemptId: attempt.id, promptEnglish: attempt.generatedEnglish, notice });
  } catch (error) {
    return errorResponse(error);
  }
}
