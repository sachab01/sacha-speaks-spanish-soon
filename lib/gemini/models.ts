/**
 * Which Gemini models each kind of call uses, tried in order (see quota.ts
 * for their free-tier limits). Kept free of server-only imports so the
 * frontend can tell a fallback-made sentence apart.
 */

export type ModelChain = readonly string[];

/**
 * The stronger models, for the low-frequency calls where quality matters
 * most (Mixed Review's batched sentence generation). Each has only 20
 * requests/day, so the chain gives ~80/day combined.
 */
export const FLASH_CHAIN = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"] as const;

/** The high-quota model for per-attempt calls (grading, pronunciation, spoken Q&A). */
export const LITE_CHAIN = ["gemini-3.5-flash-lite"] as const;

/**
 * Building a topic's sentence bank: the Flash chain, then Flash-Lite as a
 * last resort when every Flash model is overloaded or out of quota — so a
 * bank can always be built, with its sentences flagged (see
 * isWeakerFallbackModel) so they can be rebuilt later.
 */
export const BANK_CHAIN = [...FLASH_CHAIN, ...LITE_CHAIN] as const;

/** Models whose sentences get a "may be less natural" warning in the frontend. */
const WEAKER_FALLBACK_MODELS: ReadonlySet<string> = new Set(LITE_CHAIN);

export function isWeakerFallbackModel(model: string): boolean {
  return WEAKER_FALLBACK_MODELS.has(model);
}
