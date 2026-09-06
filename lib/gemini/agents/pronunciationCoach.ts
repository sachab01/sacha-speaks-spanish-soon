import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../client";

const PronunciationCoachResultSchema = z.object({
  transcript: z.string(),
  targetSpokenCorrectly: z.boolean(),
  pronunciationScore: z.number().int().min(0).max(100),
  feedbackEnglish: z.string().min(1),
});

export type PronunciationCoachResult = z.infer<typeof PronunciationCoachResultSchema>;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    targetSpokenCorrectly: { type: Type.BOOLEAN },
    pronunciationScore: { type: Type.INTEGER },
    feedbackEnglish: { type: Type.STRING },
  },
  required: ["transcript", "targetSpokenCorrectly", "pronunciationScore", "feedbackEnglish"],
};

const SYSTEM_INSTRUCTION = `You are a Spanish pronunciation coach. You are given the Spanish sentence a learner was asked to say aloud, and an audio recording of their attempt.

1. Transcribe what they actually said, in Spanish, in "transcript".
2. "targetSpokenCorrectly": true only if the words they said match the expected sentence closely enough in content — minor mispronunciation is fine, but wrong, missing, or extra words make this false.
3. "pronunciationScore" (0-100): how native-like their pronunciation, rhythm, and clarity sounded, independent of whether they said the exact right words.
4. "feedbackEnglish": 1-2 short, encouraging sentences in English, naming specific sounds/words to work on, or praising what went well.

If the audio contains no discernible speech (silence, background noise only, a non-speech tone, etc.), do not guess or assume it matches the expected sentence: set "transcript" to an empty string, "targetSpokenCorrectly" to false, "pronunciationScore" to 0, and say in "feedbackEnglish" that no speech was detected and to try recording again.`;

export async function gradePronunciation(params: {
  expectedEs: string;
  audioBytes: Buffer;
  mimeType: string;
}): Promise<PronunciationCoachResult> {
  const { expectedEs, audioBytes, mimeType } = params;

  return callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Expected Spanish sentence: "${expectedEs}"`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: PronunciationCoachResultSchema,
    audio: { data: audioBytes, mimeType },
  });
}
