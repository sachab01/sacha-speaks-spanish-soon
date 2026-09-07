import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../../mistral/client";
import { type CoveredVocabItem, formatWhitelist } from "../vocab";

const SentenceGeneratorResultSchema = z.object({
  spanish: z.string().min(1),
  english: z.string().min(1),
  wordsUsed: z.array(z.string()),
});

export type SentenceGeneratorResult = z.infer<typeof SentenceGeneratorResultSchema>;

/** The model occasionally wraps a word in markdown emphasis (**word**) — strip it, since this text is displayed and spoken verbatim, not rendered as markdown. */
function stripMarkdown(text: string): string {
  return text.replace(/[*_`]/g, "");
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    spanish: { type: Type.STRING },
    english: { type: Type.STRING },
    wordsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["spanish", "english", "wordsUsed"],
};

const SYSTEM_INSTRUCTION = `You are generating a single short, natural Spanish practice sentence for a language learner.

Rules:
- Use MEXICAN Spanish throughout — vocabulary, phrasing, and grammar. Use "ustedes" for "you all", never "vosotros". Prefer Mexican lexical choices where they differ from Peninsular Spanish.
- PRESENT TENSE ONLY — the learner isn't ready for past tense yet. Never use pretérito or imperfecto conjugations (e.g. never "fui", "tuve", "estaba", "hablé"); every verb must be in the present (or present-adjacent: commands, "voy a + infinitive" for near-future) regardless of what the topic or focus word might suggest.
- Use ONLY vocabulary from the whitelist given to you, plus ordinary Spanish function words (articles, pronouns, common prepositions/conjunctions, and basic conjugations of ser/estar/tener).
- The sentence MUST include the given focus word/phrase, naturally inflected if it's a verb.
- Combine the focus word with 1-3 other whitelist words/phrases to build a complete, natural sentence, rather than a bare restatement of the focus word alone. If a "preferred words" list is given and any fit naturally, favor those over other whitelist words for this supporting role — they're words the learner needs more practice on.
- Vary your sentence structure and word choices between calls — avoid always producing the same, most obvious example sentence for a given focus word.
- "wordsUsed" lists the whitelist entries you actually drew on (their whitelist form), including the focus word.
- "english" is a natural English translation of the sentence you produced.`;

export async function generatePracticeSentence(params: {
  focusItem: CoveredVocabItem;
  coveredVocab: CoveredVocabItem[];
  /** Words the learner is currently weakest on — a soft preference for filler word choice, not a constraint. */
  preferredWords?: CoveredVocabItem[];
  /** Recent sentences generated for this same focus item, to steer away from repeats. */
  recentSentences?: string[];
}): Promise<SentenceGeneratorResult> {
  const { focusItem, coveredVocab, preferredWords = [], recentSentences = [] } = params;

  const avoidBlock = recentSentences.length
    ? `\n\nAvoid reusing any of these exact sentences — write something different:\n${recentSentences
        .map((s) => `- ${s}`)
        .join("\n")}`
    : "";

  const preferredBlock = preferredWords.length
    ? `\n\nPreferred words for the supporting role, if any fit naturally:\n${formatWhitelist(preferredWords)}`
    : "";

  const result = await callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Focus word/phrase (must appear in the sentence): "${focusItem.spanish}" (${focusItem.english})

Covered vocabulary whitelist:
${formatWhitelist(coveredVocab)}${preferredBlock}${avoidBlock}`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: SentenceGeneratorResultSchema,
  });

  return {
    spanish: stripMarkdown(result.spanish),
    english: stripMarkdown(result.english),
    wordsUsed: result.wordsUsed.map(stripMarkdown),
  };
}
