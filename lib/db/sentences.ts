import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { NotFoundError } from "../errors";
import {
  type BankSentence,
  type BankWord,
  generateSentenceBank,
  generateTopUpSentences,
  reviewSentenceBank,
} from "../gemini/agents/sentenceBankBuilder";
import { db } from "./client";
import { exerciseAttempts, sentenceWords, sentences, topicVocab, topics, vocabItems } from "./schema";
import { findOrCreateVocabItem, linkVocabToTopic, normalizeForVocabMatch } from "./vocab";

/** Big enough that each word turns up in several different sentences, so a sentence can't just be memorized. */
const BANK_SENTENCE_COUNT = 80;
/** Every topic word should appear in at least this many sentences; fewer triggers one top-up pass. */
const MIN_SENTENCES_PER_WORD = 3;

type ExistingWord = { id: number; spanish: string; english: string; source: string };

/** A bank sentence plus which model wrote its final text and which reviewed it. */
type SourcedSentence = BankSentence & { model: string; reviewModel: string };

/**
 * The prompt asks the model not to list articles, but if it does anyway they
 * aren't turned into topic vocabulary. Everything else it lists is a word the
 * learner needs, so it's kept.
 */
const ARTICLES = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "lo"]);

/** Core glue vocabulary (see lib/db/coreVocab.ts) and articles don't count toward a topic's coverage targets. */
function isGlueWord(key: string, existingByKey: Map<string, ExistingWord>): boolean {
  return existingByKey.get(key)?.source === "core_vocab" || ARTICLES.has(key);
}

function dedupeSentences<S extends BankSentence>(bank: S[]): S[] {
  const seen = new Set<string>();
  return bank.filter((sentence) => {
    const key = normalizeForVocabMatch(sentence.spanish);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Topic words used in fewer than MIN_SENTENCES_PER_WORD sentences, with how many more each needs. */
function findUnderCoveredWords(bank: BankSentence[], existingByKey: Map<string, ExistingWord>) {
  const counts = new Map<string, { word: BankWord; count: number }>();
  for (const sentence of bank) {
    const keysInSentence = new Set(sentence.words.map((w) => normalizeForVocabMatch(w.spanish)));
    for (const key of keysInSentence) {
      if (isGlueWord(key, existingByKey)) continue;
      const word = sentence.words.find((w) => normalizeForVocabMatch(w.spanish) === key)!;
      const entry = counts.get(key) ?? { word, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return Array.from(counts.values())
    .filter(({ count }) => count < MIN_SENTENCES_PER_WORD)
    .map(({ word, count }) => ({ word, count: MIN_SENTENCES_PER_WORD - count }));
}

async function loadExistingWords(): Promise<Map<string, ExistingWord>> {
  const rows = await db
    .select({ id: vocabItems.id, spanish: vocabItems.spanish, english: vocabItems.english, source: vocabItems.source })
    .from(vocabItems)
    .where(eq(vocabItems.itemType, "word"));
  return new Map(rows.map((row) => [normalizeForVocabMatch(row.spanish), row]));
}

/**
 * Generates a topic's sentence bank without touching the DB: sentences
 * first, with the vocabulary extracted from them, then one top-up pass for
 * any word that landed in too few sentences, then a review pass that fixes
 * wrong/unnatural sentences and completes their word lists. Three requests
 * at most, out of the ~80/day the Flash chain allows.
 */
async function generateBankForTopic(
  topic: typeof topics.$inferSelect,
  existingByKey: Map<string, ExistingWord>,
): Promise<SourcedSentence[]> {
  const existingVocab = Array.from(existingByKey.values());
  const withModel = ({ sentences, model }: { sentences: BankSentence[]; model: string }) =>
    sentences.map((sentence) => ({ ...sentence, model }));

  let bank = dedupeSentences(
    withModel(
      await generateSentenceBank({
        topicName: topic.name,
        instructions: topic.instructions,
        sentenceCount: BANK_SENTENCE_COUNT,
        existingVocab,
      }),
    ),
  );

  const needed = findUnderCoveredWords(bank, existingByKey);
  if (needed.length > 0) {
    const topUp = await generateTopUpSentences({
      topicName: topic.name,
      instructions: topic.instructions,
      needed,
      existingSentences: bank.map((s) => s.spanish),
      existingVocab,
    });
    bank = dedupeSentences([...bank, ...withModel(topUp)]);
  }

  const reviewed = await reviewSentenceBank({
    topicName: topic.name,
    bank: bank.map(({ spanish, english, words }) => ({ spanish, english, words })),
    existingVocab,
  });
  // A sentence the review kept unchanged is still the original writer's; one
  // it rewrote (or added) is the reviewer's own.
  const writerByKey = new Map(bank.map((s) => [normalizeForVocabMatch(s.spanish), s.model]));
  return dedupeSentences(reviewed.sentences).map((sentence) => ({
    ...sentence,
    // Names can still slip through as "proper noun" — a sentence may mention
    // a place, but it isn't vocabulary to drill.
    words: sentence.words.filter((w) => !/proper/i.test(w.partOfSpeech)),
    model: writerByKey.get(normalizeForVocabMatch(sentence.spanish)) ?? reviewed.model,
    reviewModel: reviewed.model,
  }));
}

/**
 * Persists a generated bank: each distinct word is matched to an existing
 * global vocab item (or created), linked to the topic unless it's core glue
 * vocabulary, and linked to every sentence it appears in.
 */
async function persistBank(topicId: number, bank: SourcedSentence[], existingByKey: Map<string, ExistingWord>) {
  const idByKey = new Map<string, number>();
  for (const sentence of bank) {
    for (const word of sentence.words) {
      const key = normalizeForVocabMatch(word.spanish);
      if (idByKey.has(key)) continue;

      const existing = existingByKey.get(key);
      if (existing) {
        idByKey.set(key, existing.id);
        if (existing.source !== "core_vocab") await linkVocabToTopic(topicId, existing.id);
        continue;
      }
      if (ARTICLES.has(key)) continue;

      const { vocabItem } = await findOrCreateVocabItem({
        spanish: word.spanish,
        english: word.english,
        itemType: "word",
        partOfSpeech: word.partOfSpeech,
        source: "bank_builder",
      });
      idByKey.set(key, vocabItem.id);
      await linkVocabToTopic(topicId, vocabItem.id);
    }
  }

  const inserted = await db
    .insert(sentences)
    .values(
      bank.map((s) => ({
        topicId,
        source: "bank_builder" as const,
        spanish: s.spanish,
        english: s.english,
        model: s.model,
        reviewModel: s.reviewModel,
      })),
    )
    .returning({ id: sentences.id, spanish: sentences.spanish });
  const sentenceIdBySpanish = new Map(inserted.map((row) => [row.spanish, row.id]));

  const links = bank.flatMap((sentence) => {
    const sentenceId = sentenceIdBySpanish.get(sentence.spanish)!;
    const vocabIds = new Set(
      sentence.words
        .map((w) => idByKey.get(normalizeForVocabMatch(w.spanish)))
        .filter((id): id is number => id !== undefined),
    );
    return Array.from(vocabIds, (vocabItemId) => ({ sentenceId, vocabItemId }));
  });
  if (links.length > 0) await db.insert(sentenceWords).values(links).onConflictDoNothing();

  return { sentenceCount: inserted.length, wordCount: idByKey.size };
}

/**
 * Replaces a topic's whole bank (its words and sentences) with a freshly
 * generated sentence bank. Generation runs first, so a failed model call
 * leaves the existing bank untouched. Old vocab items that end up linked to
 * no topic and were never practiced are deleted; anything shared with
 * another topic, or with practice history, is kept.
 */
export async function rebuildTopicSentenceBank(topicId: number) {
  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
  if (!topic) throw new NotFoundError(`Topic ${topicId} not found.`);

  const existingByKey = await loadExistingWords();
  const bank = await generateBankForTopic(topic, existingByKey);

  const oldLinks = await db
    .select({ vocabItemId: topicVocab.vocabItemId })
    .from(topicVocab)
    .where(eq(topicVocab.topicId, topicId));
  await db.delete(sentences).where(and(eq(sentences.topicId, topicId), eq(sentences.source, "bank_builder")));
  await db.delete(topicVocab).where(eq(topicVocab.topicId, topicId));

  const result = await persistBank(topicId, bank, existingByKey);

  const oldIds = oldLinks.map((l) => l.vocabItemId);
  let deletedCount = 0;
  if (oldIds.length > 0) {
    const deleted = await db
      .delete(vocabItems)
      .where(
        and(
          inArray(vocabItems.id, oldIds),
          eq(vocabItems.source, "bank_builder"),
          notExists(db.select({ one: sql`1` }).from(topicVocab).where(eq(topicVocab.vocabItemId, vocabItems.id))),
          notExists(db.select({ one: sql`1` }).from(exerciseAttempts).where(eq(exerciseAttempts.vocabItemId, vocabItems.id))),
        ),
      )
      .returning({ id: vocabItems.id });
    deletedCount = deleted.length;
  }

  return { ...result, deletedOldItemCount: deletedCount, bank };
}
