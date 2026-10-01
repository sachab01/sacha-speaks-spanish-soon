import { Type } from "@google/genai";
import { z } from "zod";

import { callStructuredWithModel } from "../client";
import { BANK_CHAIN } from "../models";
import { type CoveredVocabItem, formatWhitelist } from "../vocab";

const BankWordSchema = z.object({
  spanish: z.string().min(1),
  english: z.string().min(1),
  partOfSpeech: z.string().min(1),
});

const BankSentenceSchema = z.object({
  spanish: z.string().min(1),
  english: z.string().min(1),
  words: z.array(BankWordSchema).min(1),
});

const SentenceBankSchema = z.object({ sentences: z.array(BankSentenceSchema) });

export type BankWord = z.infer<typeof BankWordSchema>;
export type BankSentence = z.infer<typeof BankSentenceSchema>;
/** One model response: its sentences, and which model in the chain wrote them. */
export type BankBatch = { sentences: BankSentence[]; model: string };

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          spanish: { type: Type.STRING },
          english: { type: Type.STRING },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                spanish: { type: Type.STRING },
                english: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
              },
              required: ["spanish", "english", "partOfSpeech"],
            },
          },
        },
        required: ["spanish", "english", "words"],
      },
    },
  },
  required: ["sentences"],
};

const SYSTEM_INSTRUCTION = `You are building a practice sentence bank for an intermediate learner of MEXICAN Spanish, for one topic at a time. The learner practices only with these sentences, and their vocabulary for the topic is extracted from them — so the sentences decide what they learn.

The most important rule: every sentence must be something native speakers in Mexico actually say in this situation. Natural, everyday, idiomatic — the phrases you'd really hear, not stilted textbook constructions. Use common, high-frequency words; never rare, overly formal, or unusual words, and never force words together that don't belong together. Before answering, reread each sentence and ask whether a Mexican speaker would really say it like that — if not, rewrite it.

Sentence rules:
- MEXICAN Spanish — vocabulary, phrasing, and grammar ("ustedes", never "vosotros"; Mexican choices like "boleto", "manejar", "platicar", "¿mande?" where natural). "tú" for informal speech, "usted" where a Mexican speaker would use it.
- PRESENT TENSE ONLY, no exceptions — never pretérito or imperfecto. Commands and "voy a + infinitive" are fine.
- Short: 3-12 words. Mix questions, answers, requests, short replies and statements — like real conversation.
- Grammatically correct: agreement, conjugation, accents, and Spanish punctuation (¿…? ¡…!).
- No two sentences the same or near-identical.
- Diverse sentences.
- The topic's vocabulary should be roughly 25-40 useful words and fixed expressions. Reuse each of them across several sentences in different contexts — every word you list for a sentence should appear in at least 3 different sentences in the bank, so the learner meets it in varied contexts instead of memorizing one sentence.

For each sentence, "words" lists every word or fixed expression in it that the learner needs to know — verbs, nouns, adjectives, adverbs (muy, mucho, también…), question words (cómo, dónde, qué…), pronouns, prepositions, and fixed expressions. Skip only articles (el, la, los, las, un, una) and proper names (people, cities, neighborhoods, brands) — a sentence may mention a place, but it isn't vocabulary. Each entry:
- "spanish": the dictionary form — infinitive for verbs ("tener", not "tengo"), singular for nouns, masculine singular for adjectives. Keep a fixed expression together as one entry when its meaning isn't just the sum of its parts ("por favor", "tener hambre", "¿qué tal?", "a la derecha"), and don't also list its parts separately.
- If a word is already in the learner's existing vocabulary list (given below), use exactly that spelling, so it's recognized as the same word.
- "english": a short English gloss of that dictionary form.
- "partOfSpeech": a short label such as "verb", "noun", "adjective", "adverb", "pronoun", "preposition", "conjunction", "question word" or "phrase" ("proper noun" for a name, if you list one at all).

"english" for the sentence is a natural English translation.

In case you want to use information about the student: Her name is Sacha, she is from Amsterdam, and is 25 years old.

The learner may also give additional instructions (a register, a subtopic to focus on or avoid, specific verbs, etc.) — follow those on top of the rules above.`;

export async function generateSentenceBank(params: {
  topicName: string;
  instructions?: string | null;
  sentenceCount: number;
  existingVocab: CoveredVocabItem[];
}): Promise<BankBatch> {
  const { topicName, instructions, sentenceCount, existingVocab } = params;

  const { data, model } = await callStructuredWithModel({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Topic: ${topicName}${instructions ? `\n\nAdditional instructions from the learner: ${instructions}` : ""}

Write ${sentenceCount} sentences.

The learner's existing vocabulary list:
${formatWhitelist(existingVocab)}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: SentenceBankSchema,
    models: BANK_CHAIN,
    // Bank building runs rarely and isn't interactive, so it can afford to
    // wait out a per-minute limit.
    maxWaitMs: 70_000,
  });
  return { sentences: data.sentences, model };
}

/**
 * Top-up pass for words the first pass used in too few sentences: asks for
 * more sentences specifically around those words, so each one is met in
 * enough different contexts.
 */
export async function generateTopUpSentences(params: {
  topicName: string;
  instructions?: string | null;
  needed: { word: CoveredVocabItem; count: number }[];
  existingSentences: string[];
  existingVocab: CoveredVocabItem[];
}): Promise<BankBatch> {
  const { topicName, instructions, needed, existingSentences, existingVocab } = params;

  const { data, model } = await callStructuredWithModel({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Topic: ${topicName}${instructions ? `\n\nAdditional instructions from the learner: ${instructions}` : ""}

The bank already has the sentences below, but some words appear in too few of them. Write additional sentences for this topic so that each word below gets at least the given number of NEW sentences containing it (one sentence may cover several of these words at once):
${needed.map(({ word, count }) => `- ${word.spanish} (${word.english}): ${count} more`).join("\n")}

Existing sentences — don't repeat or closely paraphrase any of them:
${existingSentences.map((s) => `- ${s}`).join("\n")}

The learner's existing vocabulary list:
${formatWhitelist(existingVocab)}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: SentenceBankSchema,
    models: BANK_CHAIN,
    maxWaitMs: 70_000,
  });
  return { sentences: data.sentences, model };
}

const REVIEW_INSTRUCTION = `You are a native speaker of Mexican Spanish and an experienced Spanish teacher, reviewing a practice sentence bank a colleague wrote for a beginner-to-intermediate learner. The learner will practice ONLY with these sentences, so every mistake or unnatural sentence you let through gets learned.

Check every sentence:
1. Is it grammatically correct — agreement, conjugation, word order, prepositions, accents, Spanish punctuation (¿…? ¡…!)?
2. Would a native speaker in Mexico actually say it, in those words, in everyday life? Not a literal translation from English, not a textbook construction, not two unrelated things forced together.
3. Is it in the present tense (commands and "voy a + infinitive" are fine)?
4. Is the English translation accurate and natural?
If a sentence fails any check, rewrite it into a correct, natural sentence on the same topic that uses the same words where possible — or drop it if it can't be saved. Keep sentences that pass exactly as they are.

Then check each sentence's "words" list against the final sentence text. It must contain every word or fixed expression the learner needs to know from that sentence — including adverbs (muy, mucho, también…), question words (cómo, dónde, qué…), pronouns and prepositions — in dictionary form (infinitive for verbs, singular for nouns, masculine singular for adjectives), with fixed expressions kept as one entry. Add anything missing, remove entries that no longer appear in the sentence, and remove articles and proper names (people, cities, neighborhoods, brands) entirely. Where an entry is already in the learner's existing vocabulary list, keep exactly that spelling.

Return the whole reviewed bank, in the same order, in the same JSON shape.`;

/**
 * Review pass over a whole generated bank, as a second opinion: fixes or
 * drops sentences that are wrong or unnatural, and completes each
 * sentence's word list so every word in it gets graded.
 */
export async function reviewSentenceBank(params: {
  topicName: string;
  bank: BankSentence[];
  existingVocab: CoveredVocabItem[];
}): Promise<BankBatch> {
  const { topicName, bank, existingVocab } = params;

  const { data, model } = await callStructuredWithModel({
    systemInstruction: REVIEW_INSTRUCTION,
    prompt: `Topic: ${topicName}

Sentence bank to review:
${JSON.stringify({ sentences: bank })}

The learner's existing vocabulary list:
${formatWhitelist(existingVocab)}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: SentenceBankSchema,
    models: BANK_CHAIN,
    maxWaitMs: 70_000,
  });
  return { sentences: data.sentences, model };
}
