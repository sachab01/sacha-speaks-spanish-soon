import { NextResponse } from "next/server";

import { parsePracticeMode } from "@/lib/api-utils";
import { handlePracticeAttemptRequest } from "@/lib/attempt-handler";

export async function POST(request: Request, { params }: { params: Promise<{ mode: string }> }) {
  const { mode: modeParam } = await params;
  const mode = parsePracticeMode(modeParam);
  if (!mode) {
    return NextResponse.json({ error: "Invalid practice mode" }, { status: 400 });
  }

  return handlePracticeAttemptRequest(request, mode);
}
