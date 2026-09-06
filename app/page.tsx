import Link from "next/link";

import { TopicCreateForm } from "@/components/TopicCreateForm";
import { listTopics } from "@/lib/db/topics";

export default async function HomePage() {
  const topics = await listTopics();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Spaans</h1>
        <p className="mt-1 text-sm text-neutral-500">Practice Spanish, one topic at a time.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-500 uppercase">New topic</h2>
        <TopicCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-500 uppercase">Your topics</h2>
        {topics.length === 0 ? (
          <p className="text-sm text-neutral-500">No topics yet — create one above to get started.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/topics/${topic.id}`}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  <span className="font-medium">{topic.name}</span>
                  <span className="text-neutral-500">
                    {topic.wordCount} words · {topic.sentenceCount} sentences
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
