# Spaans

A Spanish-practice app: pick a topic, Gemini builds a word/sentence bank for it, then practice with writing, speaking (pronunciation-checked), and listening exercises. Review scheduling is powered by [FSRS](https://github.com/open-spaced-repetition), and you can ask questions mid-exercise without losing your place.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) — frontend + API routes, deployed on [Vercel](https://vercel.com)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (Neon) via [Drizzle ORM](https://orm.drizzle.team)
- [Gemini API](https://ai.google.dev) (`@google/genai`) for bank generation, grading, pronunciation feedback, and the in-exercise tutor
- Browser `SpeechSynthesis` / `MediaRecorder` for text-to-speech and mic capture

## Local development

1. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY` and `DATABASE_URL`.
2. `npm install`
3. `npm run db:push` — push the Drizzle schema to your database.
4. `npm run dev` — starts the app at [http://localhost:3000](http://localhost:3000).

## Deployment

Deployed on Vercel with the Vercel Postgres (Neon) integration. See the implementation plan for the full deployment checklist.
