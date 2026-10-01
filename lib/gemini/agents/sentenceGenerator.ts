import { Type } from "@google/genai";
import { z } from "zod";

import { callStructuredWithModel } from "../client";
import type { ModelChain } from "../models";
import { type CoveredVocabItem, formatWhitelist } from "../vocab";

const GeneratedSentenceSchema = z.object({
  focusWord: z.string().min(1),
  spanish: z.string().min(1),
  english: z.string().min(1),
  wordsUsed: z.array(z.string()),
});

const SentenceBatchSchema = z.object({ sentences: z.array(GeneratedSentenceSchema) });

export type GeneratedSentence = z.infer<typeof GeneratedSentenceSchema>;

/** The model occasionally wraps a word in markdown emphasis (**word**) — strip it, since this text is displayed and spoken verbatim, not rendered as markdown. */
function stripMarkdown(text: string): string {
  return text.replace(/[*_`]/g, "");
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          focusWord: { type: Type.STRING },
          spanish: { type: Type.STRING },
          english: { type: Type.STRING },
          wordsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["focusWord", "spanish", "english", "wordsUsed"],
      },
    },
  },
  required: ["sentences"],
};

const SYSTEM_INSTRUCTION = `You write short Spanish practice sentences for a beginner-to-intermediate learner — one sentence per focus word you're given.

The most important rule: every sentence must be something a native speaker in Mexico would actually say in everyday life. Common words, natural word order, idiomatic phrasing — the kind of sentence you'd overhear at a café, in a taxi, or between friends. Never produce a stilted textbook sentence or force unrelated words together just to use them; a short, natural sentence is always better than a longer, contrived one. Before answering, reread each sentence and ask whether a Mexican speaker would really say it like that — if not, rewrite it.

Rules:
- MEXICAN Spanish throughout — vocabulary, phrasing, and grammar. Use "ustedes" for "you all", never "vosotros". Prefer Mexican lexical choices where they differ from Peninsular Spanish.
- PRESENT TENSE ONLY — the learner isn't ready for past tense yet. Never use pretérito or imperfecto conjugations (e.g. never "fui", "tuve", "estaba", "hablé"); every verb must be in the present (or present-adjacent: commands, "voy a + infinitive" for near-future).
- Each sentence MUST include its focus word/phrase, naturally inflected if it's a verb. Copy the focus word verbatim into "focusWord".
- Build the rest of the sentence from the learner's vocabulary list where those words fit naturally. You may also use very common, basic Spanish words that aren't on the list, but never rare, advanced, or regional-slang words.
- Grammatically correct and complete: right gender/number agreement, right conjugations, correct accents and Spanish punctuation (¿…? ¡…!).
- Vary sentence structure (questions, answers, requests, statements) and avoid reusing any sentence you're told to avoid.
- "wordsUsed" lists every entry from the learner's vocabulary list that the sentence uses, exactly as written in the list, including the focus word.
- "english" is a natural English translation of the sentence.`;

/**
 * Generates one fresh practice sentence per focus item in a single request —
 * batched because the free-tier limits count requests, not tokens.
 */
export async function generatePracticeSentences(params: {
  focusItems: CoveredVocabItem[];
  coveredVocab: CoveredVocabItem[];
  /** Recent sentences, to steer away from repeats. */
  recentSentences?: string[];
  models: ModelChain;
  maxWaitMs?: number;
}): Promise<{ sentences: GeneratedSentence[]; model: string }> {
  const { focusItems, coveredVocab, recentSentences = [], models, maxWaitMs } = params;

  const avoidBlock = recentSentences.length
    ? `\n\nAvoid reusing any of these exact sentences — write something different:\n${recentSentences
        .map((s) => `- ${s}`)
        .join("\n")}`
    : "";

  const { data, model } = await callStructuredWithModel({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Focus words/phrases — write exactly one sentence for each, in this order:
${formatWhitelist(focusItems)}

The learner's vocabulary list:
${formatWhitelist(coveredVocab)}${avoidBlock}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: SentenceBatchSchema,
    models,
    maxWaitMs,
  });

  return {
    model,
    sentences: data.sentences.map((s) => ({
      focusWord: stripMarkdown(s.focusWord),
      spanish: stripMarkdown(s.spanish),
      english: stripMarkdown(s.english),
      wordsUsed: s.wordsUsed.map(stripMarkdown),
    })),
  };
}
