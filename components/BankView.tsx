import type { bankItems } from "@/lib/db/schema";

type BankItem = typeof bankItems.$inferSelect;

export function BankView({ bankItems }: { bankItems: BankItem[] }) {
  const words = bankItems.filter((item) => item.itemType === "word");
  const sentences = bankItems.filter((item) => item.itemType === "sentence");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
          Words ({words.length})
        </h2>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {words.map((word) => (
            <li
              key={word.id}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
            >
              <span className="font-medium">{word.spanish}</span>
              <span className="text-neutral-500"> — {word.english}</span>
              {word.partOfSpeech && (
                <span className="ml-1 text-xs text-neutral-400">({word.partOfSpeech})</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
          Sentences ({sentences.length})
        </h2>
        <ul className="flex flex-col gap-1.5">
          {sentences.map((sentence) => (
            <li
              key={sentence.id}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
            >
              <p className="font-medium">{sentence.spanish}</p>
              <p className="text-neutral-500">{sentence.english}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
