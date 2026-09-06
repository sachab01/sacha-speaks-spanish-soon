/**
 * One-off backfill: the initial seeding only generated banks from a short
 * topic name (e.g. "Checking into a hotel"), so Gemini's own picks didn't
 * necessarily include every word/phrase the user had actually already
 * studied (from covered.md). This hand-transcribes that real material,
 * mapped onto the topics it corresponds to, and links it in via the same
 * dedup-aware seedVocabEntries used for normal topic creation — so this is
 * additive (extra Gemini-picked words stay) and duplicate-safe (a word
 * already covered elsewhere is reused, not recreated).
 *
 * Run once with: npx tsx scripts/backfill-covered-md.ts
 */
import { seedVocabEntries, type VocabEntry } from "../lib/db/topics";

const TOPIC_IDS = {
  basicSurvival: 2,
  taxisDirections: 3,
  restaurant: 4,
  shopping: 5,
  hotel: 6,
  bus: 7,
} as const;

const BACKFILL: Record<number, VocabEntry[]> = {
  [TOPIC_IDS.basicSurvival]: [
    { spanish: "No entiendo.", english: "I don't understand.", itemType: "sentence" },
    { spanish: "¿Puede repetir, por favor?", english: "Can you repeat, please?", itemType: "sentence" },
    {
      spanish: "¿Puede hablar más despacio, por favor?",
      english: "Can you speak more slowly, please?",
      itemType: "sentence",
    },
    { spanish: "¿Me puede ayudar?", english: "Can you help me?", itemType: "sentence" },
    { spanish: "Estoy perdida.", english: "I'm lost.", itemType: "sentence" },
    { spanish: "Estoy aprendiendo español.", english: "I'm learning Spanish.", itemType: "sentence" },
    { spanish: "No funciona.", english: "It doesn't work.", itemType: "sentence" },
    { spanish: "hola", english: "hello", itemType: "word" },
    { spanish: "buenas tardes", english: "good afternoon", itemType: "word" },
    { spanish: "gracias", english: "thank you", itemType: "word" },
    { spanish: "muchas gracias", english: "thank you very much", itemType: "word" },
    { spanish: "por favor", english: "please", itemType: "word" },
    { spanish: "sí, claro", english: "yes, of course", itemType: "word" },
    { spanish: "un poco", english: "a little", itemType: "word" },
    { spanish: "funcionar", english: "to work / to function", itemType: "word", partOfSpeech: "verb" },
    { spanish: "repetir", english: "to repeat", itemType: "word", partOfSpeech: "verb" },
    { spanish: "despacio", english: "slowly", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "más despacio", english: "more slowly", itemType: "word" },
    { spanish: "ayudar", english: "to help", itemType: "word", partOfSpeech: "verb" },
    { spanish: "hablar", english: "to speak", itemType: "word", partOfSpeech: "verb" },
    { spanish: "entender", english: "to understand", itemType: "word", partOfSpeech: "verb" },
    { spanish: "perdón", english: "excuse me", itemType: "word" },
  ],
  [TOPIC_IDS.taxisDirections]: [
    { spanish: "Quiero ir al centro.", english: "I want to go to the center.", itemType: "sentence" },
    { spanish: "¿Cuánto tarda?", english: "How long does it take?", itemType: "sentence" },
    { spanish: "¿Cuánto cuesta?", english: "How much does it cost?", itemType: "sentence" },
    { spanish: "¿Dónde está el cajero?", english: "Where is the ATM?", itemType: "sentence" },
    { spanish: "¿Hay un cajero?", english: "Is there an ATM?", itemType: "sentence" },
    { spanish: "¿Está cerca?", english: "Is it nearby?", itemType: "sentence" },
    { spanish: "¿Está lejos?", english: "Is it far?", itemType: "sentence" },
    { spanish: "Todo recto.", english: "Straight ahead.", itemType: "sentence" },
    { spanish: "A la derecha.", english: "To the right.", itemType: "sentence" },
    { spanish: "A la izquierda.", english: "To the left.", itemType: "sentence" },
    {
      spanish: "Todo recto y después a la derecha.",
      english: "Straight ahead and then to the right.",
      itemType: "sentence",
    },
    { spanish: "después", english: "then / afterwards", itemType: "word" },
    { spanish: "ir", english: "to go", itemType: "word", partOfSpeech: "verb" },
    { spanish: "centro", english: "center / downtown", itemType: "word" },
    { spanish: "cajero", english: "ATM", itemType: "word" },
    { spanish: "cerca", english: "near", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "lejos", english: "far", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "derecha", english: "right", itemType: "word" },
    { spanish: "izquierda", english: "left", itemType: "word" },
    { spanish: "tardar", english: "to take (time)", itemType: "word", partOfSpeech: "verb" },
  ],
  [TOPIC_IDS.restaurant]: [
    { spanish: "Quiero dos tacos al pastor, por favor.", english: "I want two al pastor tacos, please.", itemType: "sentence" },
    { spanish: "Quiero una cerveza, por favor.", english: "I want a beer, please.", itemType: "sentence" },
    { spanish: "Un agua con gas, por favor.", english: "A sparkling water, please.", itemType: "sentence" },
    { spanish: "Agua sin gas.", english: "Still water.", itemType: "sentence" },
    { spanish: "¿Qué quiere tomar?", english: "What would you like to drink?", itemType: "sentence" },
    { spanish: "Me gusta mucho.", english: "I like it a lot.", itemType: "sentence" },
    { spanish: "Me gusta la comida picante.", english: "I like spicy food.", itemType: "sentence" },
    { spanish: "Me gustan los tacos.", english: "I like tacos.", itemType: "sentence" },
    { spanish: "No me gusta el plátano.", english: "I don't like banana.", itemType: "sentence" },
    { spanish: "La cuenta, por favor.", english: "The bill, please.", itemType: "sentence" },
    { spanish: "¿Cuánto cuesta la cerveza?", english: "How much does the beer cost?", itemType: "sentence" },
    { spanish: "¿Cuánto cuestan los tacos?", english: "How much do the tacos cost?", itemType: "sentence" },
    { spanish: "con", english: "with", itemType: "word" },
    { spanish: "sin", english: "without", itemType: "word" },
    { spanish: "sin hielo", english: "without ice", itemType: "word" },
    { spanish: "sin azúcar", english: "without sugar", itemType: "word" },
    { spanish: "plátano", english: "banana", itemType: "word" },
    { spanish: "hielo", english: "ice", itemType: "word" },
    { spanish: "cebolla", english: "onion", itemType: "word" },
    { spanish: "comida", english: "food", itemType: "word" },
    { spanish: "picante", english: "spicy", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "cerveza", english: "beer", itemType: "word" },
    { spanish: "taco", english: "taco", itemType: "word" },
  ],
  [TOPIC_IDS.shopping]: [
    { spanish: "¿Qué es esto?", english: "What is this?", itemType: "sentence" },
    { spanish: "¿Cuánto cuesta esto?", english: "How much does this cost?", itemType: "sentence" },
    { spanish: "Quiero dos, por favor.", english: "I want two, please.", itemType: "sentence" },
    { spanish: "¿Puedo pagar con tarjeta?", english: "Can I pay by card?", itemType: "sentence" },
    { spanish: "Solo efectivo.", english: "Cash only.", itemType: "sentence" },
    { spanish: "No tengo efectivo.", english: "I don't have cash.", itemType: "sentence" },
    { spanish: "Está muy caro.", english: "It's very expensive.", itemType: "sentence" },
    { spanish: "Es muy caro.", english: "It's very expensive.", itemType: "sentence" },
    { spanish: "¿Hay algo más barato?", english: "Is there something cheaper?", itemType: "sentence" },
    { spanish: "Solo estoy mirando.", english: "I'm just looking.", itemType: "sentence" },
    { spanish: "caro", english: "expensive", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "barato", english: "cheap", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "más caro", english: "more expensive", itemType: "word" },
    { spanish: "más barato", english: "cheaper", itemType: "word" },
    { spanish: "algo", english: "something", itemType: "word" },
    { spanish: "tarjeta", english: "card", itemType: "word" },
    { spanish: "efectivo", english: "cash", itemType: "word" },
  ],
  [TOPIC_IDS.hotel]: [
    { spanish: "Tengo una reservación.", english: "I have a reservation.", itemType: "sentence" },
    { spanish: "Tengo una reservación para dos noches.", english: "I have a reservation for two nights.", itemType: "sentence" },
    { spanish: "¿A nombre de quién?", english: "Under what name?", itemType: "sentence" },
    { spanish: "¿Hasta qué hora es el desayuno?", english: "Until what time is breakfast?", itemType: "sentence" },
    { spanish: "¿Hay wifi gratis?", english: "Is there free Wi-Fi?", itemType: "sentence" },
    { spanish: "¿Cuál es la contraseña del wifi?", english: "What is the Wi-Fi password?", itemType: "sentence" },
    { spanish: "a nombre de", english: "under the name of", itemType: "word" },
    { spanish: "habitación", english: "room", itemType: "word" },
    { spanish: "desayuno", english: "breakfast", itemType: "word" },
    { spanish: "contraseña", english: "password", itemType: "word" },
    { spanish: "reservación", english: "reservation", itemType: "word" },
    { spanish: "noche", english: "night", itemType: "word" },
    { spanish: "gratis", english: "free", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "wifi", english: "Wi-Fi", itemType: "word" },
  ],
  [TOPIC_IDS.bus]: [
    { spanish: "autobús", english: "bus", itemType: "word" },
    { spanish: "boleto", english: "ticket", itemType: "word" },
    { spanish: "ida", english: "outward journey / one-way", itemType: "word" },
    { spanish: "regreso", english: "return", itemType: "word" },
    { spanish: "ida y regreso", english: "round trip", itemType: "word" },
    { spanish: "parada", english: "stop / bus stop", itemType: "word" },
    { spanish: "próxima", english: "next", itemType: "word", partOfSpeech: "adjective" },
    { spanish: "la próxima parada", english: "the next stop", itemType: "word" },
    { spanish: "aquí", english: "here", itemType: "word" },
    { spanish: "de aquí", english: "from here", itemType: "word" },
    { spanish: "salir", english: "to leave", itemType: "word", partOfSpeech: "verb" },
    { spanish: "sale", english: "it leaves", itemType: "word", partOfSpeech: "verb" },
    { spanish: "bajar", english: "to get off / go down", itemType: "word", partOfSpeech: "verb" },
    { spanish: "bajar en", english: "to get off at", itemType: "word" },
    { spanish: "Quiero un boleto, por favor.", english: "I want a ticket, please.", itemType: "sentence" },
    { spanish: "Quiero un boleto de ida, por favor.", english: "I want a one-way ticket, please.", itemType: "sentence" },
    {
      spanish: "Quiero un boleto de ida y regreso, por favor.",
      english: "I want a round-trip ticket, please.",
      itemType: "sentence",
    },
    { spanish: "¿Va al centro?", english: "Does it go to the center?", itemType: "sentence" },
    { spanish: "¿El autobús va al centro?", english: "Does the bus go to the center?", itemType: "sentence" },
    { spanish: "¿A qué hora sale?", english: "What time does it leave?", itemType: "sentence" },
    { spanish: "¿Dónde sale?", english: "Where does it leave from?", itemType: "sentence" },
    { spanish: "¿Sale de aquí?", english: "Does it leave from here?", itemType: "sentence" },
    { spanish: "¿Dónde está la parada?", english: "Where is the bus stop?", itemType: "sentence" },
    { spanish: "¿Cuál es la próxima parada?", english: "What is the next stop?", itemType: "sentence" },
    { spanish: "Quiero bajar en la próxima parada.", english: "I want to get off at the next stop.", itemType: "sentence" },
  ],
};

async function main() {
  for (const [topicIdStr, entries] of Object.entries(BACKFILL)) {
    const topicId = Number(topicIdStr);
    const linked = await seedVocabEntries(topicId, entries, "bank_builder");
    console.log(`topic ${topicId}: backfilled ${linked.length} entries`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
