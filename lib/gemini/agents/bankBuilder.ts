import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../client";

const BankBuilderResultSchema = z.object({
  words: z.array(
    z.object({
      spanish: z.string().min(1),
      english: z.string().min(1),
      partOfSpeech: z.string().min(1),
    }),
  ),
  sentences: z.array(
    z.object({
      spanish: z.string().min(1),
      english: z.string().min(1),
    }),
  ),
});

export type BankBuilderResult = z.infer<typeof BankBuilderResultSchema>;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
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
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          spanish: { type: Type.STRING },
          english: { type: Type.STRING },
        },
        required: ["spanish", "english"],
      },
    },
  },
  required: ["words", "sentences"],
};

const SYSTEM_INSTRUCTION = `You are a Spanish curriculum designer helping a learner build a vocabulary bank for one topic at a time.

Given a topic described in natural language, produce a focused, practical set of Spanish words and example sentences a learner would actually need for that topic.

Guidelines:
- Produce 12-20 words: the most common, directly useful nouns, verbs, and adjectives for the topic. Use dictionary/citation form in "spanish" (infinitive for verbs, singular for nouns), not a random conjugation.
- Produce 6-10 short, natural example sentences a learner would plausibly say or hear in this topic, using only vocabulary a beginner-to-intermediate learner would already know plus the words you just listed.
- Keep sentences simple (present tense, everyday phrasing) unless the topic itself implies otherwise.
- Do not list the same word twice under different endings.
- "partOfSpeech" is a short label such as "noun", "verb", "adjective", or "phrase".`;

export async function generateBank(topicName: string): Promise<BankBuilderResult> {
  return callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Topic: ${topicName}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: BankBuilderResultSchema,
  });
}
