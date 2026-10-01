export type CoveredVocabItem = { spanish: string; english: string };

export function formatWhitelist(vocab: CoveredVocabItem[]): string {
  return vocab.map((v) => `- ${v.spanish} (${v.english})`).join("\n");
}
