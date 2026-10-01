import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { geminiUsage } from "./schema";

/** Atomically counts one request against a model's day; false (nothing counted) if it's already at `dailyLimit`. */
export async function reserveDailyRequest(model: string, day: string, dailyLimit: number): Promise<boolean> {
  const rows = await db
    .insert(geminiUsage)
    .values({ model, day, requests: 1 })
    .onConflictDoUpdate({
      target: [geminiUsage.model, geminiUsage.day],
      set: { requests: sql`${geminiUsage.requests} + 1` },
      setWhere: sql`${geminiUsage.requests} < ${dailyLimit}`,
    })
    .returning({ requests: geminiUsage.requests });
  return rows.length > 0;
}

/** Gives back one request counted by reserveDailyRequest. */
export async function releaseDailyRequest(model: string, day: string): Promise<void> {
  await db
    .update(geminiUsage)
    .set({ requests: sql`greatest(${geminiUsage.requests} - 1, 0)` })
    .where(and(eq(geminiUsage.model, model), eq(geminiUsage.day, day)));
}

/** Marks a model's day as fully used, e.g. after Google itself reported the daily quota exhausted. */
export async function markDailyQuotaUsed(model: string, day: string, dailyLimit: number): Promise<void> {
  await db
    .insert(geminiUsage)
    .values({ model, day, requests: dailyLimit })
    .onConflictDoUpdate({ target: [geminiUsage.model, geminiUsage.day], set: { requests: dailyLimit } });
}
