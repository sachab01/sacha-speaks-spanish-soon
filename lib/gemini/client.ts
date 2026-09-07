import { GoogleGenAI, type Schema } from "@google/genai";
import type { ZodType } from "zod";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set. Add it to your .env.local (see .env.example).");
}

export const ai = new GoogleGenAI({ apiKey });

// gemini-3.5-flash-lite is the current free-tier-eligible model that supports
// both text and inline audio input. The non-lite gemini-3.5-flash's free tier
// is capped at only 20 requests/day (confirmed by hitting that limit during
// development) — far too low for real use; the lite variant has a much higher
// free daily quota while still handling our structured-JSON + audio calls
// fine. Overridable via env if a better option needs to be swapped in later.
// Shared across the audio-understanding agents (pronunciation grading, spoken
// Q&A) and the two highest-frequency text agents (translation grading,
// sentence generation) — the latter fall back to Mistral (grading) or simply
// error (sentence generation) if this quota is exhausted.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

const TRANSIENT_STATUS_CODES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function isTransientApiError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    TRANSIENT_STATUS_CODES.has((error as { status: unknown }).status as number)
  );
}

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientApiError(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

type StructuredCallParams<T> = {
  /** The agent's fixed role/constraints — how it should behave. */
  systemInstruction: string;
  /** The specific request for this call — what to do right now. */
  prompt: string;
  /** Gemini's OpenAPI-subset response schema, constraining the raw JSON shape. */
  responseSchema: Schema;
  /** Zod schema re-validating the parsed JSON before it's trusted by callers. */
  resultSchema: ZodType<T>;
  audio?: { data: Buffer; mimeType: string };
};

/**
 * Calls Gemini for structured JSON output, optionally with inline audio input.
 * Validates the parsed response against `resultSchema` so a malformed model
 * response fails loudly here rather than corrupting app/DB state downstream.
 */
export async function callStructured<T>({
  systemInstruction,
  prompt,
  responseSchema,
  resultSchema,
  audio,
}: StructuredCallParams<T>): Promise<T> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (audio) {
    parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data.toString("base64") } });
  }

  const response = await withRetries(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  );

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const result = resultSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(`Gemini response failed schema validation: ${result.error.message}`);
  }
  return result.data;
}
