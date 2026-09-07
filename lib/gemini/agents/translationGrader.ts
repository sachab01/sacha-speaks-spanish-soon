import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured as callGemini } from "../client";
import { callStructured as callMistral } from "../../mistral/client";

const VERDICT_VALUES = ["correct", "acceptable", "wrong", "missing"] as const;

/** The model occasionally wraps text in markdown emphasis (**word**) — strip it, since this text is displayed and spoken verbatim, not rendered as markdown. */
function stripMarkdown(text: string): string {
  return text.replace(/[*_`]/g, "");
}

// Mistral's json_object mode doesn't enforce a schema, and it sometimes omits
// fields entirely or nulls ones the schema requires as a string (e.g. it can
// decide a "missing" verdict has no "sentenceText" to point to, even though
// there's always a real span in the expected sentence) — accept all of that
// leniently at the validation boundary, then normalize to a clean shape below
// so the rest of the app never has to deal with `undefined` or an unexpected
// null, and highlighting just gracefully skips anything it can't locate.
const RawWordVerdictSchema = z.object({
  /** Null when this span isn't one of the given vocab words (grammar glue, articles, etc.) — still graded, just not FSRS-tracked. */
  vocabWord: z.string().min(1).nullable().optional(),
  sentenceText: z.string().nullable().optional(),
  userSaid: z.string().nullable().optional(),
  verdict: z.enum(VERDICT_VALUES),
  note: z.string().nullable().optional(),
});

const TranslationGradeSchema = z.object({
  words: z.array(RawWordVerdictSchema),
  feedback: z.string().min(1),
});

export type WordVerdict = {
  vocabWord: string | null;
  sentenceText: string;
  userSaid: string | null;
  verdict: (typeof VERDICT_VALUES)[number];
  note: string | null;
};

export type TranslationGradeResult = {
  words: WordVerdict[];
  feedback: string;
  gradedBy: "gemini" | "mistral";
  /** Set only when gradedBy is "mistral" — explains why the Gemini call was skipped/failed. */
  graderWarning: string | null;
};
export type TranslationDirection = "en_to_es" | "es_to_en";

/** Gemini's client already retries 429/503 internally; if it still throws with this status, the daily free-tier quota is exhausted rather than a transient blip. */
function isQuotaError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 429;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          vocabWord: { type: Type.STRING, nullable: true },
          sentenceText: { type: Type.STRING },
          userSaid: { type: Type.STRING, nullable: true },
          verdict: { type: Type.STRING, enum: [...VERDICT_VALUES] },
          note: { type: Type.STRING, nullable: true },
        },
        required: ["vocabWord", "sentenceText", "userSaid", "verdict", "note"],
      },
    },
    feedback: { type: Type.STRING },
  },
  required: ["words", "feedback"],
};

const SYSTEM_INSTRUCTION = `You are grading a Spanish learner's translation attempt. The expected translation uses MEXICAN Spanish — treat Mexican vocabulary/phrasing as correct by default, and don't penalize a learner's answer for using Mexican forms instead of Peninsular ones (e.g. "ustedes" instead of "vosotros" is correct, not a mistake).

CRITICAL RULE, apply this before anything else: accents, capitalization, and punctuation are NEVER by themselves grounds for "wrong", "acceptable", or a note. If a word/phrase matches the vocab word except for a missing/added accent mark, different capitalization, or missing/different punctuation (periods, commas, question marks, exclamation marks), it is "correct" — full stop, no exception, no note about it. Worked examples:
- "mas" for "más" → correct (missing accent — ignore it).
- "esta" for "está" → correct (missing accent — ignore it).
- "Quiero ir al centro" for the vocab word "Quiero ir al centro." → correct (the missing final period is irrelevant).
- "hola" for "Hola" → correct (capitalization is irrelevant).
Only judge the actual letters that aren't accents/capitalization/punctuation. A real letter substitution or omission (e.g. "ola" for "hola" — a missing 'h', a different word) is NOT covered by this rule and should be graded normally as wrong/acceptable below.

SECOND CRITICAL RULE: some vocab words only carry meaning combined with a neighboring one, collapsing into a single word/phrase in the other language — e.g. Spanish "más" + "despacio" together mean English "more slowly"/"slower"; neither means anything alone in that translation. If the learner's answer conveys the FULL combined meaning via one word/phrase, every vocab word that contributes to that combined meaning is "correct" (or "acceptable" if it's a natural paraphrase) — never mark one of them "missing" just because, in isolation, it isn't repeated as its own separate word once its neighbor already accounts for the shared meaning. Example: vocab words "más" and "despacio", learner's answer "slower" → both are "correct", not one "correct" and the other "missing".

THIRD CRITICAL RULE: judge by MEANING, not surface spelling similarity. Before calling something a "spelling mistake" or "acceptable", check whether the word the learner actually used is a REAL, DIFFERENT word with its own distinct meaning — if so, it is "wrong" (a wrong word choice), never "acceptable" and never described as a spelling issue, no matter how similar the spelling looks. Example: vocab word "dar" (to give), learner wrote "provar" (to try/taste) — "provar" is a real, different verb with a different meaning; this is "wrong" ("wrong verb — 'provar' means 'to try/taste', not 'dar' (to give)"), NOT "acceptable" and NOT a spelling mistake, even though the words are short and share some letters. Reserve "spelling mistake" framing for when the learner's letters clearly garble the SAME intended word (e.g. "dsr" for "dar") rather than forming a different real word.

You are given the exact vocabulary words the expected sentence was built from ("vocab words"), but you must grade the ENTIRE expected sentence, not just those words — grammar, articles, pronouns, and other "glue" content the sentence also contains can still be wrong (e.g. wrong gender/number agreement like "esto taco" instead of "este taco", a wrong verb conjugation) and must still be caught, even though they aren't in the vocab word list. Go through the whole sentence and produce one entry per meaningful WORD or multi-word phrase:
- If it corresponds to one of the given vocab words, set "vocabWord" to that exact word, verbatim.
- Otherwise (ordinary grammar/glue content not in the list), set "vocabWord" to null — it still gets graded normally below, it's just not one of the tracked vocab words.
- Never create a separate entry for bare punctuation on its own (a lone "¿", "?", ",", "." with no letters) — that would contradict the CRITICAL RULE above. Punctuation is either part of a neighboring word's entry (and still ignored per that rule) or skipped entirely, never its own "missing"/"wrong" entry.
Do not skip any actual word, even if the rest of the answer is otherwise correct:
- "correct": the learner produced this word (or an equivalent inflected form of it) correctly, per the CRITICAL RULE above.
- "acceptable": the learner used a different, valid word/phrase with essentially the SAME real-world meaning instead of this one (a true synonym or rephrasing) — per the THIRD CRITICAL RULE, this does NOT apply if the word they used has a different meaning. Set "note" to name what they used and briefly characterize it, e.g. "you used 'copa' — a common, equally natural synonym for 'vaso' (glass)" or "...an unusual/formal choice for everyday speech". Always fill this in for "acceptable" — it's useful feedback even though it isn't an error.
- "wrong": a real error — either a genuinely different word with a different meaning (see THIRD CRITICAL RULE), or a garbled spelling of the intended word, or a grammar mistake. Set "note" to a specific reason, correctly framed as either a wrong word (state both meanings) or a spelling slip (state the intended word), e.g. "wrong verb — 'trae' (brings) not 'llevar' (to carry away)", "feminine adjectives end in -a". If the learner's word isn't a real word but is a recognizable near-miss of the correct one (e.g. an anglicized guess, a half-remembered conjugation), say so — note that it would likely still be understood, alongside the standard word to use instead — rather than only calling it "wrong" with no acknowledgment that it's close.
- "missing": the learner's answer never addressed this word/concept at all. Before using this verdict, re-scan the learner's ENTIRE answer (not just the words near this one) for this exact word/phrase or an inflected form of it — a neighboring word being wrong must never cause you to overlook a correct word sitting right next to it. If it's genuinely present anywhere in the answer, grade it "correct"/"acceptable"/"wrong" instead — never "missing" for a word the learner actually wrote. Set "note" briefly explaining what's missing.

Keep every "note" concrete and no longer than it needs to be — most fit in a short phrase, but let a note run to a full sentence when there's something worth explaining (like the near-miss/likely-understood case above). Never pad with encouragement or filler, and never restate a correction that belongs to a different entry's span; each entry's "note" covers only its own word/phrase, even if a neighboring entry is also wrong.

"vocabWord" in your response must exactly repeat the vocab word it corresponds to, verbatim, from the list you were given.
"sentenceText" must be the exact substring, copied character-for-character, from the "Expected translation" text given below, that corresponds to this vocab word — this is used to highlight it directly in the displayed sentence, so it must be findable verbatim in that text (if the SECOND CRITICAL RULE applies and several vocab words share one combined phrase, they can share the same "sentenceText").
"userSaid" is whatever word/phrase in the learner's answer corresponds to this vocab word (null if "missing").

If the learner's answer is blank or clearly not a real attempt, mark every vocab word "missing".

"feedback": AT MOST one short, plain sentence in English — no encouragement or filler phrases ("great job", "don't forget", "keep practicing"). State only the single most important concrete thing to fix (what's wrong and what the correct Spanish is), or exactly "All correct." if there were no "wrong"/"missing" verdicts. Don't repeat detail already captured in the per-word notes.`;

/** Whether any real error exists — drives the UI's "Correct"/"Not quite" badge. Synonym use ("acceptable") doesn't count as a mistake. */
export function hadMistakes(words: WordVerdict[]): boolean {
  return words.some((w) => w.verdict === "wrong" || w.verdict === "missing");
}

export async function gradeTranslation(params: {
  expected: string;
  userAnswer: string;
  direction: TranslationDirection;
  /** The exact vocab words (citation form) the expected sentence was built from — see sentenceGenerator's wordsUsed. */
  wordsUsed: string[];
}): Promise<TranslationGradeResult> {
  const { expected, userAnswer, direction, wordsUsed } = params;
  const directionLabel = direction === "en_to_es" ? "English to Spanish" : "Spanish to English";

  const callParams = {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Direction: ${directionLabel}
Expected translation: "${expected}"
Vocab words this sentence was built from: ${wordsUsed.join(", ")}
Learner's answer: "${userAnswer.trim() || "(blank)"}"`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: TranslationGradeSchema,
  };

  let raw: z.infer<typeof TranslationGradeSchema>;
  let gradedBy: "gemini" | "mistral";
  let graderWarning: string | null;
  try {
    raw = await callGemini(callParams);
    gradedBy = "gemini";
    graderWarning = null;
  } catch (error) {
    console.error("Gemini grading failed, falling back to Mistral", error);
    raw = await callMistral(callParams);
    gradedBy = "mistral";
    graderWarning = isQuotaError(error)
      ? "Gemini's free daily quota is used up — this was graded with a backup model, which may be less accurate."
      : "Gemini was temporarily unavailable — this was graded with a backup model, which may be less accurate.";
  }

  return {
    // Free-form prose the model writes fresh can carry stray markdown emphasis
    // (**word**) — strip it, since this text is displayed and spoken verbatim,
    // not rendered as markdown. sentenceText/vocabWord/userSaid aren't touched:
    // they need to stay exact substrings for matching/highlighting.
    feedback: stripMarkdown(raw.feedback),
    gradedBy,
    graderWarning,
    words: raw.words.map((w) => ({
      vocabWord: w.vocabWord ?? null,
      // Falls back to an empty string (never matches anything) rather than
      // crashing — that word just won't get inline-highlighted, but still
      // shows in the notes list below via its other fields.
      sentenceText: w.sentenceText ?? "",
      userSaid: w.userSaid ?? null,
      verdict: w.verdict,
      note: w.note ? stripMarkdown(w.note) : null,
    })),
  };
}
