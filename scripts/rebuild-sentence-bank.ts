/**
 * Rebuilds one topic's bank as a sentence bank (see lib/db/sentences.ts):
 * generates sentences first, extracts their vocabulary, and replaces the
 * topic's old words/sentences.
 *
 * Run with: npx dotenv -e .env.local -- npx tsx scripts/rebuild-sentence-bank.ts <topicId>
 */
import { sql } from "drizzle-orm";

import { db } from "../lib/db/client";
import { rebuildTopicSentenceBank } from "../lib/db/sentences";

async function main() {
  const topicId = Number(process.argv[2]);
  if (!Number.isInteger(topicId) || topicId <= 0) throw new Error("Usage: rebuild-sentence-bank.ts <topicId>");

  const started = Date.now();
  const result = await rebuildTopicSentenceBank(topicId);
  console.log(
    `Topic ${topicId}: ${result.sentenceCount} sentences, ${result.wordCount} distinct words, ` +
      `${result.deletedOldItemCount} old unused items deleted (${Math.round((Date.now() - started) / 1000)}s)`,
  );

  const coverage = await db.execute(sql`
    select v.spanish, v.source, count(*)::int as sentences
    from sentence_words sw
    join sentences s on s.id = sw.sentence_id and s.topic_id = ${topicId}
    join vocab_items v on v.id = sw.vocab_item_id
    group by v.spanish, v.source
    order by count(*) asc, v.spanish`);
  console.log("Sentences per word (fewest first):");
  for (const row of coverage.rows) console.log(`  ${row.sentences}  ${row.spanish}${row.source === "core_vocab" ? " (core)" : ""}`);

  const usage = await db.execute(sql`select model, day, requests from gemini_usage order by day desc, model`);
  console.log("Gemini usage:", usage.rows);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
