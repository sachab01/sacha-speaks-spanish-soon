import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../client";

const CLOSENESS_VALUES = ["exact", "minor_variation", "wrong_word", "wrong", "unattempted"] as const;

const TranslationGradeSchema = z.object({
  closeness: z.enum(CLOSENESS_VALUES),
  feedback: z.string().min(1),
});

export type TranslationGradeResult = z.infer<typeof TranslationGradeSchema>;
export type TranslationDirection = "en_to_es" | "es_to_en";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    closeness: { type: Type.STRING, enum: [...CLOSENESS_VALUES] },
    feedback: { type: Type.STRING },
  },
  required: ["closeness", "feedback"],
};

const SYSTEM_INSTRUCTION = `You are grading a Spanish learner's translation attempt. The expected translations use MEXICAN Spanish — treat Mexican vocabulary/phrasing as correct by default, and don't penalize a learner's answer for using Mexican forms instead of Peninsular ones (e.g. "ustedes" instead of "vosotros" is correct, not a mistake).

Compare the learner's answer to the expected translation and classify "closeness":
- "exact": correct, or an equally valid synonym/phrasing. Missing accents or minor capitalization slips still count as "exact" if the content is otherwise fully correct.
- "minor_variation": right meaning, with a small correctable slip (wrong gender/number agreement, a minor typo, an awkward but understandable phrasing).
- "wrong_word": used an incorrect word for a key concept, but the sentence structure shows they understood the task.
- "wrong": largely incorrect or nonsensical.
- "unattempted": blank, or clearly not a real attempt.

Give short, encouraging, specific feedback (1-2 sentences) naming what was right or wrong.`;

export async function gradeTranslation(params: {
  expected: string;
  userAnswer: string;
  direction: TranslationDirection;
}): Promise<TranslationGradeResult> {
  const { expected, userAnswer, direction } = params;
  const directionLabel = direction === "en_to_es" ? "English to Spanish" : "Spanish to English";

  return callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Direction: ${directionLabel}
Expected translation: "${expected}"
Learner's answer: "${userAnswer.trim() || "(blank)"}"`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: TranslationGradeSchema,
  });
}
