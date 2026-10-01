import { markDailyQuotaUsed, releaseDailyRequest, reserveDailyRequest } from "../db/geminiUsage";
import { QuotaExhaustedError } from "../errors";

/**
 * Free-tier limits per model, as shown on this project's AI Studio rate-limit
 * dashboard (https://aistudio.google.com/rate-limit). Tokens-per-minute
 * (250K on all of these) is never close to being hit by this app's calls, so
 * only requests are tracked.
 */
const MODEL_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  "gemini-3.8-flash": { rpm: 5, rpd: 20 },
  "gemini-3.7-flash": { rpm: 5, rpd: 20 },
  "gemini-3.6-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash-lite": { rpm: 15, rpd: 500 },
};

/**
 * The stronger models, tried in order, for the low-frequency calls where
 * quality matters most (building a topic's sentence bank, Mixed Review's
 * batched sentence generation). Each has only 20 requests/day, so the chain
 * gives ~80/day combined.
 */
export const FLASH_CHAIN = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"] as const;

/** The high-quota model for per-attempt calls (grading, pronunciation, spoken Q&A). */
export const LITE_CHAIN = ["gemini-3.5-flash-lite"] as const;

export type ModelChain = readonly string[];

/**
 * Our own per-minute count runs one under Google's limit: Google's window
 * isn't guaranteed to line up with ours, so cutting it exactly at the limit
 * can still trip a 429 at the edges.
 */
const RPM_SAFETY_MARGIN = 1;
const MINUTE_MS = 60_000;

type QuotaState = {
  /** Start times of recent requests per model, for the rolling one-minute window. */
  recentRequests: Map<string, number[]>;
  /** Models known to be out of daily quota, keyed by model -> quota day — avoids a DB round trip per call once exhausted. */
  exhaustedDay: Map<string, string>;
  /** Models that recently answered "overloaded" (500/503), keyed by model -> time to try them again. */
  unavailableUntil: Map<string, number>;
};

// Kept on globalThis so Fast Refresh re-evaluating this module in dev doesn't
// wipe the per-minute window (the daily count lives in the DB regardless).
const globalForQuota = globalThis as typeof globalThis & { __geminiQuota?: QuotaState };
const state: QuotaState = (globalForQuota.__geminiQuota ??= {
  recentRequests: new Map(),
  exhaustedDay: new Map(),
  unavailableUntil: new Map(),
});
// A module from before unavailableUntil existed may still be on globalThis after Fast Refresh.
state.unavailableUntil ??= new Map();

/** How long to skip a model after it reports being overloaded, so each call doesn't spend a request rediscovering it. */
const UNAVAILABLE_COOLDOWN_MS = 5 * 60_000;

/** Google resets free-tier daily quotas at midnight Pacific time, so the quota "day" is a Pacific calendar date. */
function quotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

function limitsFor(model: string) {
  const limits = MODEL_LIMITS[model];
  if (!limits) throw new Error(`No rate limits configured for Gemini model "${model}" — add it to MODEL_LIMITS.`);
  return limits;
}

/** 0 if a request can be sent right now, else how long until a slot in the rolling minute frees up. */
function minuteWaitMs(model: string, now: number): number {
  const window = (state.recentRequests.get(model) ?? []).filter((t) => now - t < MINUTE_MS);
  state.recentRequests.set(model, window);
  const allowed = limitsFor(model).rpm - RPM_SAFETY_MARGIN;
  if (window.length < allowed) return 0;
  return window[window.length - allowed] + MINUTE_MS - now;
}

/**
 * Picks the first model in `chain` that has quota left, waiting up to
 * `maxWaitMs` for a per-minute slot if every model with daily quota left is
 * momentarily at its per-minute limit. Counts the request against that
 * model before returning it — so call this immediately before sending.
 * Throws QuotaExhaustedError if nothing frees up in time.
 */
export async function acquireModel(chain: ModelChain, maxWaitMs = 0): Promise<string> {
  const deadline = Date.now() + maxWaitMs;

  while (true) {
    const day = quotaDay();
    const now = Date.now();
    let shortestWait = Infinity;

    // Recently overloaded models go last rather than being skipped outright,
    // so a chain whose every model is overloaded still gets one more try.
    const isCoolingDown = (model: string) => (state.unavailableUntil.get(model) ?? 0) > now;
    const ordered = [...chain.filter((m) => !isCoolingDown(m)), ...chain.filter(isCoolingDown)];

    for (const model of ordered) {
      if (state.exhaustedDay.get(model) === day) continue;

      const wait = minuteWaitMs(model, now);
      if (wait > 0) {
        shortestWait = Math.min(shortestWait, wait);
        continue;
      }

      // Claim the minute slot before awaiting the DB, so two concurrent
      // callers can't both see the same free slot.
      const window = state.recentRequests.get(model)!;
      window.push(now);
      if (await reserveDailyRequest(model, day, limitsFor(model).rpd)) return model;
      window.splice(window.indexOf(now), 1);
      state.exhaustedDay.set(model, day);
    }

    if (shortestWait === Infinity) {
      throw new QuotaExhaustedError("daily", `Daily Gemini quota used up for ${chain.join(", ")}.`);
    }
    if (Date.now() + shortestWait > deadline) {
      throw new QuotaExhaustedError("minute", `Gemini per-minute limit reached for ${chain.join(", ")}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, shortestWait));
  }
}

/**
 * Records a 429 Google returned despite our own counting — e.g. requests
 * made with the same key from elsewhere, or made before this tracking
 * existed today. Google's error names the violated quota, which tells a
 * daily limit apart from a per-minute one.
 */
export async function recordRateLimitError(model: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (/per ?day/i.test(message)) {
    const day = quotaDay();
    state.exhaustedDay.set(model, day);
    await markDailyQuotaUsed(model, day, limitsFor(model).rpd);
  } else {
    // Treat the rest of this minute as full.
    const now = Date.now();
    state.recentRequests.set(model, Array(limitsFor(model).rpm).fill(now));
  }
}

/**
 * Records a 500/503 ("overloaded"), so the next calls try the rest of the
 * chain first for a few minutes, and gives back the daily request it was
 * counted as — an overload spike would otherwise burn through a 20/day
 * model in a handful of failed calls. If Google does count failed requests
 * after all, the worst case is a 429 naming the daily quota, which
 * recordRateLimitError then turns into "exhausted for today".
 */
export async function recordUnavailable(model: string): Promise<void> {
  state.unavailableUntil.set(model, Date.now() + UNAVAILABLE_COOLDOWN_MS);
  await releaseDailyRequest(model, quotaDay());
}
