import { eq } from "drizzle-orm";

import { NotFoundError } from "../errors";
import { createInitialSrsCard } from "../fsrs";
import { answerQuestion } from "../gemini/agents/tutor";
import { db } from "./client";
import { EXERCISE_TYPES, getCoveredVocab, type ExerciseType } from "./practice";
import { bankItems, exerciseAttempts, qnaLog, srsState, topics } from "./schema";

type Question = { text: string } | { audioBytes: { data: Buffer; mimeType: string } };

async function loadAttemptAndTopic(attemptId: string, expectedTopicId?: number) {
  const [attempt] = await db.select().from(exerciseAttempts).where(eq(exerciseAttempts.id, attemptId));
  if (!attempt || (expectedTopicId !== undefined && attempt.topicId !== expectedTopicId)) {
    throw new NotFoundError("Practice attempt not found.");
  }

  const [topic] = await db.select().from(topics).where(eq(topics.id, attempt.topicId));
  if (!topic) throw new NotFoundError("Topic not found.");

  return { attempt, topic };
}

async function answerAndExtendBank(params: {
  attempt: typeof exerciseAttempts.$inferSelect;
  topic: typeof topics.$inferSelect;
  question: Question;
}) {
  const { attempt, topic, question } = params;
  const topicId = topic.id;

  const coveredVocab = await getCoveredVocab(topicId);

  const tutorResult = await answerQuestion({
    topicName: topic.name,
    exerciseType: attempt.exerciseType as ExerciseType,
    currentSpanish: attempt.generatedSpanish,
    currentEnglish: attempt.generatedEnglish,
    coveredVocab,
    question: "text" in question ? { text: question.text } : { audioBytes: question.audioBytes },
  });

  const existingSpanishLower = new Set(coveredVocab.map((v) => v.spanish.toLowerCase()));
  const newVocabAdded: { spanish: string; english: string }[] = [];
  const newVocabLogged: { spanish: string; english: string; itemType: "word" | "sentence"; added: boolean }[] = [];

  for (const vocab of tutorResult.newVocab) {
    const alreadyCovered = existingSpanishLower.has(vocab.spanish.toLowerCase());
    newVocabLogged.push({ ...vocab, added: !alreadyCovered });
    if (alreadyCovered) continue;

    const [inserted] = await db
      .insert(bankItems)
      .values({
        topicId,
        itemType: vocab.itemType,
        spanish: vocab.spanish,
        english: vocab.english,
        partOfSpeech: null,
        source: "tutor_qna",
      })
      .returning();

    existingSpanishLower.add(vocab.spanish.toLowerCase());

    const now = new Date();
    await db.insert(srsState).values(
      EXERCISE_TYPES.map((exerciseType) => ({
        bankItemId: inserted.id,
        exerciseType,
        ...createInitialSrsCard(now),
      })),
    );

    newVocabAdded.push({ spanish: inserted.spanish, english: inserted.english });
  }

  await db.insert(qnaLog).values({
    topicId,
    attemptId: attempt.id,
    questionText: "text" in question ? question.text : null,
    questionAudioTranscript: "text" in question ? null : tutorResult.questionTranscript,
    answerText: tutorResult.answerText,
    onTopic: tutorResult.onTopic,
    newVocabJson: newVocabLogged,
  });

  return {
    answerText: tutorResult.answerText,
    onTopic: tutorResult.onTopic,
    questionTranscript: tutorResult.questionTranscript,
    newVocabAdded,
  };
}

/** Per-topic Q&A: the attempt must belong to the given topic. */
export async function askQuestion(params: { topicId: number; attemptId: string; question: Question }) {
  const { attempt, topic } = await loadAttemptAndTopic(params.attemptId, params.topicId);
  return answerAndExtendBank({ attempt, topic, question: params.question });
}

/** Mixed Review Q&A: no topic in the URL — the attempt's own topic is used. */
export async function askQuestionMixed(params: { attemptId: string; question: Question }) {
  const { attempt, topic } = await loadAttemptAndTopic(params.attemptId);
  return answerAndExtendBank({ attempt, topic, question: params.question });
}
