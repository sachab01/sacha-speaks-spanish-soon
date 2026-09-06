import { NextResponse } from "next/server";

import { ConflictError, NotFoundError } from "./errors";

function geminiApiStatus(error: unknown): number | null {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status: unknown }).status as number
    : null;
}

/** Maps thrown errors to an HTTP response, logging server-side detail for anything unexpected. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  const geminiStatus = geminiApiStatus(error);
  if (geminiStatus === 429) {
    return NextResponse.json(
      { error: "Gemini's free tier is briefly rate-limited — wait a few seconds and try again." },
      { status: 429 },
    );
  }
  if (geminiStatus === 503) {
    return NextResponse.json(
      { error: "Gemini is temporarily overloaded — please try again shortly." },
      { status: 503 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export const PRACTICE_MODES = ["writing", "speaking", "listening"] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export function parsePracticeMode(mode: string): PracticeMode | null {
  return (PRACTICE_MODES as readonly string[]).includes(mode) ? (mode as PracticeMode) : null;
}
