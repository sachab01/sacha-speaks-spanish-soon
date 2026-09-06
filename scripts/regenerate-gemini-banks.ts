/**
 * Re-runs Gemini's own bank generation for every existing topic and layers
 * the results in via the same dedup-aware seedVocabEntries used elsewhere.
 * Needed because dropping the old bank_items table also destroyed topic 1's
 * only vocabulary (it wasn't covered by the covered.md backfill), and
 * topics 2-7 should keep Gemini's own supplementary picks alongside the
 * hand-curated covered.md entries, not just the exact backfilled list.
 *
 * Run once with: npx tsx scripts/regenerate-gemini-banks.ts
 */
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { generateBank } from "../lib/gemini/agents/bankBuilder";
import { topics } from "../lib/db/schema";
import { seedVocabEntries, type VocabEntry } from "../lib/db/topics";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const allTopics = await db.select().from(topics).where(eq(topics.id, topics.id)).orderBy(topics.id);

  for (const topic of allTopics) {
    const bank = await generateBank(topic.name);
    const entries: VocabEntry[] = [
      ...bank.words.map((w) => ({
        spanish: w.spanish,
        english: w.english,
        itemType: "word" as const,
        partOfSpeech: w.partOfSpeech,
      })),
      ...bank.sentences.map((s) => ({
        spanish: s.spanish,
        english: s.english,
        itemType: "sentence" as const,
      })),
    ];
    const linked = await seedVocabEntries(topic.id, entries, "bank_builder");
    console.log(`topic ${topic.id} (${topic.name}): generated ${entries.length}, linked ${linked.length}`);
    await sleep(4000);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
