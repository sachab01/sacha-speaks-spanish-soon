import { eq } from "drizzle-orm";

import { NotFoundError } from "../errors";
import { answerQuestion } from "../gemini/agents/tutor";
import { db } from "./client";
import { getAllCoveredVocab, getCoveredVocab, type ExerciseType } from "./practice";
import { exerciseAttempts, qnaLog, topics } from "./schema";
import { findOrCreateVocabItem, linkVocabToTopic } from "./vocab";

type Question = { text: string } | { audioBytes: { data: Buffer; mimeType: string } };

async function loadAttemptContext(attemptId: string, expectedTopicId?: number) {
  const [attempt] = await db.select().from(exerciseAttempts).where(eq(exerciseAttempts.id, attemptId));
  if (!attempt || (expectedTopicId !== undefined && attempt.topicId !== expectedTopicId)) {
    throw new NotFoundError("Practice attempt not found.");
  }

  let topicName = "Mixed Review (across multiple topics)";
  if (attempt.topicId !== null) {
    const [topic] = await db.select().from(topics).where(eq(topics.id, attempt.topicId));
    if (!topic) throw new NotFoundError("Topic not found.");
    topicName = topic.name;
  }

  return { attempt, topicId: attempt.topicId, topicName };
}

async function answerAndExtendBank(params: {
  attempt: typeof exerciseAttempts.$inferSelect;
  topicId: number | null;
  topicName: string;
  question: Question;
}) {
  const { attempt, topicId, topicName, question } = params;

  const coveredVocab = topicId !== null ? await getCoveredVocab(topicId) : await getAllCoveredVocab();

  const tutorResult = await answerQuestion({
    topicName,
    exerciseType: attempt.exerciseType as ExerciseType,
    currentSpanish: attempt.generatedSpanish,
    currentEnglish: attempt.generatedEnglish,
    coveredVocab,
    question: "text" in question ? { text: question.text } : { audioBytes: question.audioBytes },
  });

  const newVocabAdded: { spanish: string; english: string }[] = [];
  const newVocabLogged: { spanish: string; english: string; itemType: "word" | "sentence"; added: boolean }[] = [];

  for (const vocab of tutorResult.newVocab) {
    const { vocabItem, created } = await findOrCreateVocabItem({
      spanish: vocab.spanish,
      english: vocab.english,
      itemType: vocab.itemType,
      source: "tutor_qna",
    });

    // Per-topic: also link it into this topic's bank if it wasn't already there
    // (even when the word itself was already known globally from elsewhere).
    // Mixed Review has no single topic to link into.
    const linkedNewly = topicId !== null ? await linkVocabToTopic(topicId, vocabItem.id) : false;

    const isNewToUser = created || linkedNewly;
    newVocabLogged.push({ spanish: vocab.spanish, english: vocab.english, itemType: vocab.itemType, added: isNewToUser });
    if (isNewToUser) {
      newVocabAdded.push({ spanish: vocabItem.spanish, english: vocabItem.english });
    }
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
  const { attempt, topicId, topicName } = await loadAttemptContext(params.attemptId, params.topicId);
  return answerAndExtendBank({ attempt, topicId, topicName, question: params.question });
}

/** Mixed Review Q&A: no topic in the URL — the attempt's own topic (or lack thereof) is used. */
export async function askQuestionMixed(params: { attemptId: string; question: Question }) {
  const { attempt, topicId, topicName } = await loadAttemptContext(params.attemptId);
  return answerAndExtendBank({ attempt, topicId, topicName, question: params.question });
}
