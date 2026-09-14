import { findOrCreateVocabItem } from "./vocab";

type CoreVocabEntry = { spanish: string; english: string; partOfSpeech: string };

/**
 * Always-available Mexican Spanish glue words (no vosotros forms) — shared
 * globally, not linked to any single topic (see ensureCoreVocabSeeded).
 * Sentence generation for every topic and Mixed Review can freely draw on
 * these regardless of that topic's own bank, and they accumulate their own
 * mastery score as they show up in generated sentences.
 */
const CORE_VOCAB: CoreVocabEntry[] = [
  // Articles
  { spanish: "el", english: "the (m. sg.)", partOfSpeech: "article" },
  { spanish: "la", english: "the (f. sg.)", partOfSpeech: "article" },
  { spanish: "los", english: "the (m. pl.)", partOfSpeech: "article" },
  { spanish: "las", english: "the (f. pl.)", partOfSpeech: "article" },
  { spanish: "un", english: "a/an (m.)", partOfSpeech: "article" },
  { spanish: "una", english: "a/an (f.)", partOfSpeech: "article" },
  // Subject pronouns
  { spanish: "yo", english: "I", partOfSpeech: "pronoun" },
  { spanish: "tú", english: "you (informal)", partOfSpeech: "pronoun" },
  { spanish: "usted", english: "you (formal)", partOfSpeech: "pronoun" },
  { spanish: "él", english: "he", partOfSpeech: "pronoun" },
  { spanish: "ella", english: "she", partOfSpeech: "pronoun" },
  { spanish: "nosotros", english: "we", partOfSpeech: "pronoun" },
  { spanish: "ustedes", english: "you all", partOfSpeech: "pronoun" },
  { spanish: "ellos", english: "they (m.)", partOfSpeech: "pronoun" },
  { spanish: "ellas", english: "they (f.)", partOfSpeech: "pronoun" },
  // Object/reflexive pronouns
  { spanish: "me", english: "me/myself", partOfSpeech: "pronoun" },
  { spanish: "te", english: "you/yourself", partOfSpeech: "pronoun" },
  { spanish: "le", english: "to him/her/you", partOfSpeech: "pronoun" },
  { spanish: "nos", english: "us/ourselves", partOfSpeech: "pronoun" },
  { spanish: "les", english: "to them/you all", partOfSpeech: "pronoun" },
  { spanish: "se", english: "himself/herself/themselves", partOfSpeech: "pronoun" },
  // Possessives
  { spanish: "mi", english: "my", partOfSpeech: "pronoun" },
  { spanish: "tu", english: "your (informal)", partOfSpeech: "pronoun" },
  { spanish: "su", english: "his/her/your/their", partOfSpeech: "pronoun" },
  // Prepositions
  { spanish: "de", english: "of/from", partOfSpeech: "preposition" },
  { spanish: "a", english: "to/at", partOfSpeech: "preposition" },
  { spanish: "en", english: "in/on", partOfSpeech: "preposition" },
  { spanish: "con", english: "with", partOfSpeech: "preposition" },
  { spanish: "por", english: "for/because of", partOfSpeech: "preposition" },
  { spanish: "para", english: "for/in order to", partOfSpeech: "preposition" },
  { spanish: "sin", english: "without", partOfSpeech: "preposition" },
  { spanish: "sobre", english: "on/about", partOfSpeech: "preposition" },
  // Conjunctions
  { spanish: "y", english: "and", partOfSpeech: "conjunction" },
  { spanish: "o", english: "or", partOfSpeech: "conjunction" },
  { spanish: "pero", english: "but", partOfSpeech: "conjunction" },
  { spanish: "que", english: "that/which", partOfSpeech: "conjunction" },
  // Negation
  { spanish: "no", english: "no/not", partOfSpeech: "conjunction" },
  // ser
  { spanish: "ser", english: "to be (permanent)", partOfSpeech: "verb" },
  { spanish: "soy", english: "I am", partOfSpeech: "verb" },
  { spanish: "es", english: "he/she/it is", partOfSpeech: "verb" },
  { spanish: "somos", english: "we are", partOfSpeech: "verb" },
  { spanish: "son", english: "they/you all are", partOfSpeech: "verb" },
  // estar
  { spanish: "estar", english: "to be (state/location)", partOfSpeech: "verb" },
  { spanish: "estoy", english: "I am (state/location)", partOfSpeech: "verb" },
  { spanish: "está", english: "he/she/it is (state/location)", partOfSpeech: "verb" },
  { spanish: "estamos", english: "we are (state/location)", partOfSpeech: "verb" },
  { spanish: "están", english: "they/you all are (state/location)", partOfSpeech: "verb" },
  // tener
  { spanish: "tener", english: "to have", partOfSpeech: "verb" },
  { spanish: "tengo", english: "I have", partOfSpeech: "verb" },
  { spanish: "tiene", english: "he/she/it has", partOfSpeech: "verb" },
  { spanish: "tenemos", english: "we have", partOfSpeech: "verb" },
  { spanish: "tienen", english: "they/you all have", partOfSpeech: "verb" },
];

/** Idempotent — findOrCreateVocabItem no-ops for entries that already exist. Run once via a throwaway script. */
export async function ensureCoreVocabSeeded() {
  for (const entry of CORE_VOCAB) {
    await findOrCreateVocabItem({
      spanish: entry.spanish,
      english: entry.english,
      itemType: "word",
      partOfSpeech: entry.partOfSpeech,
      source: "core_vocab",
    });
  }
}
