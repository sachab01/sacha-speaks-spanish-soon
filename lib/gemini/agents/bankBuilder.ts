import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../../mistral/client";

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

Use MEXICAN Spanish throughout — vocabulary, phrasing, and grammar (e.g. "ustedes" instead of "vosotros" for "you all", Mexican lexical choices where they differ from Peninsular Spanish, such as "boleto" not "billete", "manejar" not "conducir", "plática"/"platicar" alongside "conversación"/"hablar"). Never use vosotros forms.

Guidelines:
- Produce 12-20 words: the most common, directly useful nouns, verbs, and adjectives for the topic. Use dictionary/citation form in "spanish" (infinitive for verbs, singular for nouns), not a random conjugation.
- Produce 6-10 short, natural example sentences a learner would plausibly say or hear in this topic, using only vocabulary a beginner-to-intermediate learner would already know plus the words you just listed.
- PRESENT TENSE ONLY, no exceptions — the learner isn't ready for past tense yet. Never use pretérito or imperfecto conjugations, even if the topic's name suggests a past-tense framing; keep sentences simple and everyday, present tense throughout.
- Do not list the same word twice under different endings.
- "partOfSpeech" is a short label such as "noun", "verb", "adjective", or "phrase".
- The learner may also give additional instructions about what kinds of words/sentences they want (a register, a subtopic to focus on or avoid, a specific set of verbs, etc.) — follow those on top of the guidelines above rather than instead of them.`;

export async function generateBank(topicName: string, instructions?: string): Promise<BankBuilderResult> {
  const prompt = instructions
    ? `Topic: ${topicName}\n\nAdditional instructions from the learner: ${instructions}`
    : `Topic: ${topicName}`;
  return callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: BankBuilderResultSchema,
  });
}
