import { GoogleGenAI, type Schema } from "@google/genai";
import type { ZodType } from "zod";

import { httpStatusOf, QuotaExhaustedError } from "../errors";
import type { ModelChain } from "./models";
import { acquireModel, recordRateLimitError, recordUnavailable } from "./quota";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set. Add it to your .env.local (see .env.example).");
}

export const ai = new GoogleGenAI({ apiKey });

const TRANSIENT_STATUS_CODES = new Set([500, 503]);
/** Pause before going through the whole chain again when every model in it reported being overloaded. */
const OVERLOAD_RETRY_DELAY_MS = 30_000;

/**
 * Sends one request on the first model in `models` with quota left. A 429
 * is never retried on the same model — retrying a per-minute or daily limit
 * a second later just burns more requests — it's recorded and the next model
 * in the chain is tried instead. A transient 500/503 ("overloaded") moves on
 * to the next model too; once every model in the chain has been overloaded,
 * the whole chain is tried again after a pause, for up to `overloadWaitMs`.
 */
async function generateWithQuota<R>(
  models: ModelChain,
  maxWaitMs: number,
  overloadWaitMs: number,
  send: (model: string) => Promise<R>,
): Promise<{ response: R; model: string }> {
  const overloadDeadline = Date.now() + overloadWaitMs;
  let remaining = [...models];
  let lastOverloadError: unknown = null;

  /** Once every model with quota left has been overloaded: pause and start over, or give up with that error. */
  async function waitOutOverload() {
    const delay = Math.min(OVERLOAD_RETRY_DELAY_MS, overloadDeadline - Date.now());
    if (delay <= 0) throw lastOverloadError;
    console.warn(`[gemini] every model is overloaded — trying again in ${Math.round(delay / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    remaining = [...models];
  }

  while (true) {
    let model: string;
    try {
      model = await acquireModel(remaining, maxWaitMs);
    } catch (error) {
      // Out of quota on the models still in play, but others were only
      // overloaded — those still have quota, so they're worth waiting for.
      if (error instanceof QuotaExhaustedError && lastOverloadError !== null) {
        await waitOutOverload();
        continue;
      }
      throw error;
    }

    try {
      const response = await send(model);
      if (model !== models[0]) console.info(`[gemini] served by fallback model ${model}`);
      return { response, model };
    } catch (error) {
      const status = httpStatusOf(error);
      if (status !== null) console.warn(`[gemini] ${model} failed with ${status}, trying the next option`);
      if (status === 429) {
        await recordRateLimitError(model, error);
      } else if (status !== null && TRANSIENT_STATUS_CODES.has(status)) {
        await recordUnavailable(model);
        lastOverloadError = error;
        remaining = remaining.filter((m) => m !== model);
        if (remaining.length === 0) await waitOutOverload();
      } else {
        throw error;
      }
    }
  }
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
  /** Models to try in order (see quota.ts) — the first with quota left is used, the rest are fallbacks. */
  models: ModelChain;
  /** How long to wait for a per-minute slot before giving up with QuotaExhaustedError (default: don't wait). */
  maxWaitMs?: number;
  /** How long to keep retrying while every model is overloaded (503) before giving up (default: don't retry). */
  overloadWaitMs?: number;
};

/**
 * Calls Gemini for structured JSON output, optionally with inline audio input.
 * Validates the parsed response against `resultSchema` so a malformed model
 * response fails loudly here rather than corrupting app/DB state downstream.
 */
export async function callStructured<T>(params: StructuredCallParams<T>): Promise<T> {
  return (await callStructuredWithModel(params)).data;
}

/** callStructured, plus which model in the chain actually answered — for callers that record where content came from. */
export async function callStructuredWithModel<T>({
  systemInstruction,
  prompt,
  responseSchema,
  resultSchema,
  audio,
  models,
  maxWaitMs = 0,
  overloadWaitMs = 0,
}: StructuredCallParams<T>): Promise<{ data: T; model: string }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (audio) {
    parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data.toString("base64") } });
  }

  const { response, model: usedModel } = await generateWithQuota(models, maxWaitMs, overloadWaitMs, (model) =>
    ai.models.generateContent({
      model,
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
  return { data: result.data, model: usedModel };
}
