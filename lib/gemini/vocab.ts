export type CoveredVocabItem = { spanish: string; english: string };

/**
 * Grammatical glue words a beginner-to-intermediate learner is assumed to
 * already know, so the covered-vocabulary whitelist doesn't need to spell
 * out every article/pronoun/conjugation of ser-estar-tener.
 */
export const SPANISH_FUNCTION_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo",
  "de", "del", "al", "a", "en", "con", "por", "para", "sin", "sobre", "entre", "hasta", "desde", "hacia",
  "y", "o", "u", "e", "pero", "que", "si", "no", "se",
  "yo", "tú", "tu", "usted", "él", "ella", "nosotros", "nosotras", "vosotros", "vosotras", "ellos", "ellas", "ustedes",
  "me", "te", "le", "nos", "os", "les", "mi", "mis", "tus", "su", "sus", "nuestro", "nuestra", "nuestros", "nuestras",
  "ser", "es", "soy", "eres", "somos", "son", "era", "fue", "sido", "seré",
  "estar", "estoy", "estás", "está", "estamos", "están", "estaba", "estuvo",
  "tener", "tengo", "tienes", "tiene", "tenemos", "tienen", "tenía", "tuvo",
  "muy", "más", "menos", "también", "ya", "aquí", "allí", "ahora", "hoy",
]);

/** Strips punctuation and lowercases, for a rough word-level comparison. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[¿?¡!.,;:"'()«»]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

export function formatWhitelist(vocab: CoveredVocabItem[]): string {
  return vocab.map((v) => `- ${v.spanish} (${v.english})`).join("\n");
}

/**
 * Best-effort check for words in `sentence` that aren't in the covered
 * vocabulary (or the function-word allowance). This is a heuristic, not a
 * guarantee: it doesn't lemmatize, so a covered verb's conjugated forms can
 * be flagged as "uncovered" even though a human would recognize them.
 * Callers should treat a non-empty result as "worth a retry", not proof of
 * an actual violation.
 */
export function findUncoveredTokens(sentence: string, coveredVocab: CoveredVocabItem[]): string[] {
  const coveredTokens = new Set<string>();
  for (const item of coveredVocab) {
    for (const token of tokenize(item.spanish)) coveredTokens.add(token);
  }

  const uncovered: string[] = [];
  for (const token of tokenize(sentence)) {
    if (SPANISH_FUNCTION_WORDS.has(token) || coveredTokens.has(token)) continue;
    uncovered.push(token);
  }
  return uncovered;
}
