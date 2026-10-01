import { NextResponse } from "next/server";

import { ConflictError, httpStatusOf, NotFoundError, QuotaExhaustedError } from "./errors";

/** Maps thrown errors to an HTTP response, logging server-side detail for anything unexpected. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof QuotaExhaustedError) {
    return NextResponse.json(
      {
        error:
          error.kind === "daily"
            ? "Today's free Gemini quota is used up — it resets around 9:00 Amsterdam time."
            : "Gemini's per-minute limit is reached — wait a few seconds and try again.",
      },
      { status: 429 },
    );
  }

  const geminiStatus = httpStatusOf(error);
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

export const PRACTICE_FOCUSES = ["due", "weakest", "stale"] as const;
export type PracticeFocus = (typeof PRACTICE_FOCUSES)[number];

/** Reads `?focus=` from a request URL, defaulting to "due" for anything missing or invalid. */
export function parsePracticeFocus(request: Request): PracticeFocus {
  const value = new URL(request.url).searchParams.get("focus");
  return value && (PRACTICE_FOCUSES as readonly string[]).includes(value) ? (value as PracticeFocus) : "due";
}

/** Mixed Review's "generate fresh sentences" toggle, carried as `?generate=1`. */
export function parseGenerateFlag(value: string | null | undefined): boolean {
  return value === "1";
}
