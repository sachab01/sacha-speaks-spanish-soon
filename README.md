# sacha-speaks-spanish-soon


A Spanish-practice app: pick a topic, [Gemini](https://ai.google.dev) generates a word/sentence bank for it, then you practice with writing, speaking (pronunciation-checked), and listening exercises. Review scheduling is powered by [FSRS](https://github.com/open-spaced-repetition), so exercises resurface based on what you're actually about to forget, and you can ask questions mid-exercise without losing your place.

> **Status: work in progress.** This is a personal side project I'm actively building and using myself — not a finished product. See [Known limitations](#known-limitations--roadmap) below for what's still missing.

## What makes this different from flashcards

The core idea: **you should never be able to memorize the sentence instead of learning the word.** Most vocab apps quiz you on a fixed bank of pre-written sentences, so after enough repetitions you're pattern-matching the sentence, not recalling the word. Here, every practice attempt asks Gemini to generate a brand-new sentence on the spot — it must use the specific word being tested plus 1-3 other words you already know, combined into something a native speaker would actually say, and it's steered away from repeating recent sentences for that word. So the same word keeps showing up in different, realistic contexts instead of the same memorized line.

That's paired with per-word spaced repetition (FSRS) rather than per-topic or per-deck scheduling, so what surfaces for review is driven by what you're actually about to forget, across every topic at once.

It also treats writing, speaking, and listening as three equally-weighted, on-demand modes rather than one dominant mode with the others sprinkled in occasionally. Most apps default hard to reading/writing and surface a listening exercise every so often as a change of pace; here you can drill listening (or speaking) as much as you want, whenever you want, on the same underlying vocabulary.

Feedback is specific, not binary. Grading doesn't just mark an answer right or wrong — it's classified on a closeness scale (exact / minor slip / wrong word / wrong / unattempted) and comes with a short explanation naming what actually went wrong: which word you likely confused it with, a gender/number agreement slip, or, for speaking, which specific sounds to work on.

## Features

- **Novel-sentence generation, not fixed decks** — see above; sentences are generated fresh per attempt from your known-vocabulary whitelist, not pulled from a static bank.
- **Topic-driven generation** — describe a topic (e.g. "ordering coffee", "at the doctor") and Gemini builds a vocabulary bank for it.
- **Global vocabulary** — words are shared across topics instead of duplicated, so recall tracking stays consistent no matter where a word was first learned.
- **Three exercise types** — writing (typed translation, graded by Gemini), speaking (recorded via the mic, checked for pronunciation), and listening (Gemini speaks a sentence via TTS, you type the English translation, graded the same way as writing).
- **Mixed review mode** — practice across all topics at once, focused on your weakest or most stale items rather than one topic in isolation.
- **Spaced repetition (FSRS)** — every attempt updates a per-word retrievability estimate; the "skill overview" page shows live recall estimates per word, per topic, and overall, decaying continuously between reviews.
- **In-exercise Q&A** — ask a grammar/vocab question mid-exercise without losing your place in the review queue.
- **Locked to Mexican Spanish** — generation and grading are pinned to one dialect/register for consistency.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Drizzle ORM](https://orm.drizzle.team) over Postgres ([Neon](https://neon.tech))
- [Gemini API](https://ai.google.dev) (`@google/genai`) for bank generation, grading, pronunciation feedback, and the in-exercise Q&A
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) for spaced-repetition scheduling
- Browser `SpeechSynthesis` / `MediaRecorder` for text-to-speech and mic capture — no server-side audio processing

## Local development

1. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY` ([get one here](https://aistudio.google.com/apikey)) and `DATABASE_URL` (a Postgres connection string — [Neon](https://neon.tech) works well for this).
2. `npm install`
3. `npm run db:push` — push the Drizzle schema to your database.
4. `npm run dev` — starts the app at [http://localhost:3000](http://localhost:3000).

There's no seed data — the first thing to do after setup is create a topic from the home page, which triggers Gemini to generate its bank.

## Known limitations / roadmap

This is mid-build, not finished. Notably:

- **No authentication.** Everything is single-user by design right now; there's no login or per-user data separation.
- **No way to delete topics or words yet.** Deletion cascades exist at the DB level, but there's no user-facing action to trigger one.
- **One model doing every job.** Bank generation, sentence generation, grading, pronunciation feedback, and the tutor all currently call the same Gemini model (`gemini-3.5-flash-lite`, chosen for its free-tier quota). Different tasks likely want different models/settings — still needs balancing.
- **Repeat-avoidance is a soft prompt hint, not a hard guarantee.** The sentence generator is told which recent sentences to avoid, but nothing enforces novelty deterministically — could still use more deterministic scaffolding around the LLM calls generally.
- **Prompts are still being tuned.** Generation/grading quality varies by topic and needs more iteration.
- **No automated tests.**
- **No rate limiting or cost guards** around the Gemini calls — fine for personal use, not safe to expose publicly as-is.
- Mobile layout and cross-browser mic/speech-API support haven't been hardened.

Because of the first two points, this repo doesn't link a public live demo — it's meant to be run locally by anyone reviewing the code.

## License

MIT — see [LICENSE](LICENSE).
