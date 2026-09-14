type BankItem = {
  id: number;
  itemType: "word" | "sentence";
  spanish: string;
  english: string;
  partOfSpeech: string | null;
};

export function BankView({ bankItems }: { bankItems: BankItem[] }) {
  const words = bankItems.filter((item) => item.itemType === "word");
  const sentences = bankItems.filter((item) => item.itemType === "sentence");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-2xl font-black text-accent-600 dark:text-accent-400">
          Words ({words.length})
        </h2>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {words.map((word) => (
            <li
              key={word.id}
              className="rounded-lg border border-accent-100 px-3 py-2 text-sm transition-colors hover:border-accent-300 hover:bg-accent-50/60 dark:border-accent-900 dark:hover:border-accent-800 dark:hover:bg-accent-950/30"
            >
              <span className="font-bold">{word.spanish}</span>
              <span className="font-bold text-accent-600 dark:text-accent-400"> — {word.english}</span>
              {word.partOfSpeech && (
                <span className="ml-1 text-xs font-bold text-accent-500 dark:text-accent-500">({word.partOfSpeech})</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-2xl font-black text-accent-600 dark:text-accent-400">
          Sentences ({sentences.length})
        </h2>
        <ul className="flex flex-col gap-1.5">
          {sentences.map((sentence) => (
            <li
              key={sentence.id}
              className="rounded-lg border border-accent-100 px-3 py-2 text-sm transition-colors hover:border-accent-300 hover:bg-accent-50/60 dark:border-accent-900 dark:hover:border-accent-800 dark:hover:bg-accent-950/30"
            >
              <p className="font-bold">{sentence.spanish}</p>
              <p className="font-bold text-accent-600 dark:text-accent-400">{sentence.english}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
