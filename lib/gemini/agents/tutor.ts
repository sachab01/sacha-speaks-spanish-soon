import { Type } from "@google/genai";
import { z } from "zod";

import { callStructured } from "../client";
import { type CoveredVocabItem, formatWhitelist } from "../vocab";

const NewVocabItemSchema = z.object({
  spanish: z.string().min(1),
  english: z.string().min(1),
  itemType: z.enum(["word", "sentence"]),
});

const TutorResultSchema = z.object({
  answerText: z.string().min(1),
  onTopic: z.boolean(),
  newVocab: z.array(NewVocabItemSchema),
  questionTranscript: z.string().nullable(),
});

export type TutorResult = z.infer<typeof TutorResultSchema>;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answerText: { type: Type.STRING },
    onTopic: { type: Type.BOOLEAN },
    newVocab: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          spanish: { type: Type.STRING },
          english: { type: Type.STRING },
          itemType: { type: Type.STRING, enum: ["word", "sentence"] },
        },
        required: ["spanish", "english", "itemType"],
      },
    },
    questionTranscript: { type: Type.STRING, nullable: true },
  },
  required: ["answerText", "onTopic", "newVocab", "questionTranscript"],
};

const SYSTEM_INSTRUCTION = `You are a focused Spanish tutor helping a learner mid-exercise.

You are given the current topic, exercise, the sentence/prompt they're working on, and the full list of Spanish vocabulary they've covered so far. The learner may ask a question at any point (typed, or transcribed from speech).

- Answer questions about the current material (grammar, vocabulary, meaning, "why is it phrased this way") helpfully and concisely.
- Stay scoped to helping them learn Spanish for this exercise. If asked something unrelated (general chit-chat, unrelated topics, requests to change the exercise), politely decline and redirect them back to practicing — set "onTopic" to false and keep "answerText" brief in that case.
- If your answer uses a Spanish word or phrase that is NOT already in their covered-vocabulary list, you MUST report it in "newVocab" (so it can be added to their bank) — unless it's an extremely basic function word a beginner already knows (articles, basic pronouns). If you used nothing new, return an empty "newVocab" array.
- Keep "answerText" conversational and concise (2-4 sentences), in English, with Spanish terms quoted.
- "questionTranscript": if the question came from an audio recording, put your transcription of what they said here; if it came as text, set this to null.`;

export async function answerQuestion(params: {
  topicName: string;
  exerciseType: "writing" | "speaking" | "listening";
  currentSpanish: string;
  currentEnglish: string;
  coveredVocab: CoveredVocabItem[];
  question: { text: string; audioBytes?: undefined } | { text?: undefined; audioBytes: { data: Buffer; mimeType: string } };
}): Promise<TutorResult> {
  const { topicName, exerciseType, currentSpanish, currentEnglish, coveredVocab, question } = params;

  const contextBlock = `Topic: ${topicName}
Exercise type: ${exerciseType}
Current sentence/prompt — Spanish: "${currentSpanish}" / English: "${currentEnglish}"

Covered vocabulary whitelist:
${formatWhitelist(coveredVocab)}`;

  if (question.text !== undefined) {
    return callStructured({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: `${contextBlock}

Learner's question: "${question.text}"`,
      responseSchema: RESPONSE_SCHEMA,
      resultSchema: TutorResultSchema,
    });
  }

  return callStructured({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `${contextBlock}

The learner's question is in the attached audio recording. Transcribe it into "questionTranscript" and answer it.`,
    responseSchema: RESPONSE_SCHEMA,
    resultSchema: TutorResultSchema,
    audio: question.audioBytes,
  });
}
