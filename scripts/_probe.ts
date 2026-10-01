import { ai } from "../lib/gemini/client";
async function main() {
  for (const model of ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]) {
    try {
      const r = await ai.models.generateContent({ model, contents: "Say hola" });
      console.log(model, "OK", r.text?.slice(0, 20));
    } catch (e) {
      console.log(model, "ERR", (e as { status?: number }).status);
    }
  }
}
main().then(() => process.exit(0));
