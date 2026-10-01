import { isWeakerFallbackModel } from "./gemini/models";

/** Which model wrote a sentence and which reviewed it — either null when unknown or not applicable. */
export type SentenceOrigin = { model: string | null; reviewModel: string | null };

/**
 * How a sentence's origin is shown to the learner, e.g. "gemini-3.6-flash,
 * reviewed by gemini-3.5-flash". Null when it isn't known (sentences made
 * before this was tracked).
 */
export function sentenceSourceLabel(origin: SentenceOrigin): string | null {
  if (!origin.model) return null;
  return origin.reviewModel ? `${origin.model}, reviewed by ${origin.reviewModel}` : origin.model;
}

/** Whether a weaker fallback model (see BANK_CHAIN) wrote or reviewed the sentence. */
export function madeByWeakerFallback(origin: SentenceOrigin): boolean {
  return [origin.model, origin.reviewModel].some((m) => m !== null && isWeakerFallbackModel(m));
}
