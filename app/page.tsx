import Link from "next/link";

import { TopicCreateForm } from "@/components/TopicCreateForm";
import { TopicPracticeMenu } from "@/components/TopicPracticeMenu";
import { ArrowRightIcon, MicIcon, PencilIcon, SpeakerIcon } from "@/components/ui/icons";
import { listTopics } from "@/lib/db/topics";

// Otherwise Next statically prerenders this at build time and bakes in
// whatever topics existed then, instead of the live list.
export const dynamic = "force-dynamic";

const MIXED_MODES = [
  { mode: "writing", icon: PencilIcon, bg: "bg-accent-600 hover:bg-accent-700", text: "text-[var(--background)]" },
  { mode: "speaking", icon: MicIcon, bg: "bg-blue hover:bg-blue-dark", text: "text-[var(--background)]" },
  { mode: "listening", icon: SpeakerIcon, bg: "bg-mustard hover:bg-mustard-dark", text: "text-ink" },
] as const;

export default async function HomePage() {
  const topics = await listTopics();

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-10 px-6 py-10 md:px-12">
      <div>
        <h1 className="font-display font-display-hero text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] font-bold break-words text-accent-600 dark:text-accent-400">
          SachaSpeaksSpanishSoon
        </h1>
        <p className="mt-2 text-base font-bold text-accent-600 dark:text-accent-400">
          Practice Spanish, one topic at a time.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-2xl font-black text-accent-600 dark:text-accent-400">New topic</h2>
        <div className="max-w-xl">
          <TopicCreateForm />
        </div>
      </section>

      {topics.length > 0 && (
        <section>
          <h2 className="mb-2 text-2xl font-black text-accent-600 dark:text-accent-400">Mixed review</h2>
          <p className="mb-4 max-w-xl text-sm font-bold text-accent-600 dark:text-accent-400">
            Practice due words and sentences from every topic together, combined into fresh sentences.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {MIXED_MODES.map(({ mode, icon: Icon, bg, text }) => (
              <Link
                key={mode}
                href={`/practice/mixed/${mode}`}
                className={`flex flex-col items-center gap-2 rounded-lg py-7 text-sm font-bold capitalize transition-colors ${bg} ${text}`}
              >
                <Icon className="h-5 w-5" />
                {mode}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-black text-accent-600 dark:text-accent-400">Your topics</h2>
        {topics.length === 0 ? (
          <p className="rounded-lg border border-dashed border-accent-300 py-10 text-center text-sm font-bold text-accent-600 dark:border-accent-800 dark:text-accent-400">
            No topics yet — create one above to get started.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <li
                key={topic.id}
                className="flex flex-col gap-3 rounded-lg bg-accent-600 p-5 text-[var(--background)] transition-colors hover:bg-accent-700"
              >
                <Link href={`/topics/${topic.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{topic.name}</span>
                    <span className="text-sm font-bold text-[var(--background)]/80">
                      {topic.wordCount} words · {topic.sentenceCount} sentences
                    </span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0" />
                </Link>
                <div>
                  <TopicPracticeMenu topicId={topic.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
