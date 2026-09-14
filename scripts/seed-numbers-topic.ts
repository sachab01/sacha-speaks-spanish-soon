/**
 * One-off seed: creates a "Numbers" topic and hand-generates its vocab
 * instead of going through the Gemini bank builder, since number words
 * need to be exhaustive and exact (not "AI's pick of ~20 relevant words").
 * Covers 0-100 individually, then each hundred (200, 300, ... 900) and
 * each thousand (1000, 2000, ... 9000) as standalone words, mirroring how
 * a learner would actually encounter/use them rather than spelling out
 * every number in between.
 *
 * Run once with: npx dotenv -e .env.local -- npx tsx scripts/seed-numbers-topic.ts
 */
import { db } from "../lib/db/client";
import { topics } from "../lib/db/schema";
import { seedVocabEntries, type VocabEntry } from "../lib/db/topics";

const ONES = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
];
const ONES_EN = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

const TEENS: Record<number, [string, string]> = {
  10: ["diez", "ten"],
  11: ["once", "eleven"],
  12: ["doce", "twelve"],
  13: ["trece", "thirteen"],
  14: ["catorce", "fourteen"],
  15: ["quince", "fifteen"],
  16: ["dieciséis", "sixteen"],
  17: ["diecisiete", "seventeen"],
  18: ["dieciocho", "eighteen"],
  19: ["diecinueve", "nineteen"],
};

const TWENTIES: Record<number, [string, string]> = {
  20: ["veinte", "twenty"],
  21: ["veintiuno", "twenty-one"],
  22: ["veintidós", "twenty-two"],
  23: ["veintitrés", "twenty-three"],
  24: ["veinticuatro", "twenty-four"],
  25: ["veinticinco", "twenty-five"],
  26: ["veintiséis", "twenty-six"],
  27: ["veintisiete", "twenty-seven"],
  28: ["veintiocho", "twenty-eight"],
  29: ["veintinueve", "twenty-nine"],
};

const TENS: Record<number, string> = {
  30: "treinta",
  40: "cuarenta",
  50: "cincuenta",
  60: "sesenta",
  70: "setenta",
  80: "ochenta",
  90: "noventa",
};
const TENS_EN: Record<number, string> = {
  30: "thirty",
  40: "forty",
  50: "fifty",
  60: "sixty",
  70: "seventy",
  80: "eighty",
  90: "ninety",
};

const HUNDREDS: Record<number, [string, string]> = {
  200: ["doscientos", "two hundred"],
  300: ["trescientos", "three hundred"],
  400: ["cuatrocientos", "four hundred"],
  500: ["quinientos", "five hundred"],
  600: ["seiscientos", "six hundred"],
  700: ["setecientos", "seven hundred"],
  800: ["ochocientos", "eight hundred"],
  900: ["novecientos", "nine hundred"],
};

function numberWord(n: number): { spanish: string; english: string } {
  if (n < 10) return { spanish: ONES[n], english: ONES_EN[n] };
  if (n < 20) {
    const [es, en] = TEENS[n];
    return { spanish: es, english: en };
  }
  if (n < 30) {
    const [es, en] = TWENTIES[n];
    return { spanish: es, english: en };
  }
  if (n < 100) {
    const tensBase = Math.floor(n / 10) * 10;
    const remainder = n % 10;
    if (remainder === 0) return { spanish: TENS[tensBase], english: TENS_EN[tensBase] };
    return {
      spanish: `${TENS[tensBase]} y ${ONES[remainder]}`,
      english: `${TENS_EN[tensBase]}-${ONES_EN[remainder]}`,
    };
  }
  if (n === 100) return { spanish: "cien", english: "hundred (one hundred)" };
  throw new Error(`numberWord() only handles 0-100, got ${n}`);
}

function buildEntries(): VocabEntry[] {
  const entries: VocabEntry[] = [];

  for (let n = 0; n <= 100; n++) {
    const { spanish, english } = numberWord(n);
    entries.push({ spanish, english, itemType: "word", partOfSpeech: "number" });
  }

  for (let h = 200; h <= 900; h += 100) {
    const [spanish, english] = HUNDREDS[h];
    entries.push({ spanish, english, itemType: "word", partOfSpeech: "number" });
  }

  entries.push({ spanish: "mil", english: "one thousand", itemType: "word", partOfSpeech: "number" });
  for (let k = 2; k <= 9; k++) {
    entries.push({
      spanish: `${ONES[k]} mil`,
      english: `${ONES_EN[k]} thousand`,
      itemType: "word",
      partOfSpeech: "number",
    });
  }

  return entries;
}

async function main() {
  const entries = buildEntries();
  console.log(`Prepared ${entries.length} number entries:`);
  for (const e of entries) console.log(`  ${e.spanish} — ${e.english}`);

  if (process.argv.includes("--dry-run")) {
    console.log("Dry run — not writing to the database.");
    return;
  }

  const [topic] = await db.insert(topics).values({ name: "Numbers" }).returning();
  console.log(`Created topic "${topic.name}" (id ${topic.id})`);

  const linked = await seedVocabEntries(topic.id, entries, "bank_builder");
  console.log(`Linked ${linked.length} vocab items to topic ${topic.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
