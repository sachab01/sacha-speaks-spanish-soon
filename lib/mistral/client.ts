import { Type, type Schema } from "@google/genai";
import type { ZodType } from "zod";

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set. Add it to your .env.local (see .env.example).");
}

// Free-tier accounts only get real rate-limit quota on a subset of models —
// verified empirically per-account at https://admin.mistral.ai/plateforme/limits,
// since the API returns 429/403 for models the console lists but doesn't
// actually grant. ministral-14b-2512 is the best-quality model confirmed
// accessible on this account's free tier; used for the text-only agents
// (bank building, sentence generation, translation grading, text Q&A) so
// those high-frequency calls don't compete with Gemini's quota, which is
// reserved for the audio-understanding agents Mistral's free tier can't do
// (pronunciation grading, spoken Q&A).
export const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "ministral-14b-2512";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const TRANSIENT_STATUS_CODES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number } | undefined)?.status;
      if (!status || !TRANSIENT_STATUS_CODES.has(status) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

/**
 * Mistral's "json_object" mode guarantees valid JSON but, unlike Gemini's
 * responseSchema, doesn't enforce a specific shape — so instead this walks
 * the same Gemini-style Schema object each agent already defines and renders
 * it as a readable skeleton to spell out in the prompt. The parsed response
 * is still re-validated against `resultSchema` below as the real guardrail.
 */
function shapeOf(schema: Schema): unknown {
  if (schema.type === Type.OBJECT) {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      obj[key] = shapeOf(value as Schema);
    }
    return obj;
  }
  if (schema.type === Type.ARRAY) {
    return [shapeOf(schema.items as Schema)];
  }

  let base: string;
  if (schema.type === Type.STRING) {
    base = schema.enum ? (schema.enum as string[]).join(" | ") : "string";
  } else if (schema.type === Type.BOOLEAN) {
    base = "boolean";
  } else if (schema.type === Type.NUMBER || schema.type === Type.INTEGER) {
    base = "number";
  } else {
    base = "any";
  }
  return schema.nullable ? `${base} | null` : base;
}

type StructuredCallParams<T> = {
  /** The agent's fixed role/constraints — how it should behave. */
  systemInstruction: string;
  /** The specific request for this call — what to do right now. */
  prompt: string;
  /** Same Gemini-style schema each agent already defines; rendered into the prompt here. */
  responseSchema: Schema;
  /** Zod schema re-validating the parsed JSON before it's trusted by callers. */
  resultSchema: ZodType<T>;
};

/**
 * Calls Mistral for structured JSON output. Matches the call shape of
 * lib/gemini/client.ts's callStructured so agent modules can switch provider
 * by only changing an import, with no changes to prompts or schemas.
 */
export async function callStructured<T>({
  systemInstruction,
  prompt,
  responseSchema,
  resultSchema,
}: StructuredCallParams<T>): Promise<T> {
  const shape = JSON.stringify(shapeOf(responseSchema), null, 2);
  const fullSystemInstruction = `${systemInstruction}\n\nRespond with ONLY a single JSON object (no markdown code fences, no commentary before or after) matching exactly this shape:\n${shape}`;

  const data = await withRetries(async () => {
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: fullSystemInstruction },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error = new Error(`Mistral API error ${response.status}: ${body.slice(0, 300)}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }

    return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
  });

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Mistral returned an empty response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error(`Mistral returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const result = resultSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(`Mistral response failed schema validation: ${result.error.message}`);
  }
  return result.data;
}
