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

Live at **https://spaans-two.vercel.app** — deployed on Vercel (project `sacha-17e7/spaans`), connected to the Neon Postgres project `cold-truth-97532120`. `GEMINI_API_KEY` and `DATABASE_URL` are set as Production environment variables in the Vercel project settings.

To redeploy: `vercel --prod` from the project root (the GitHub repo isn't auto-deploy-connected yet — that needs the Vercel-for-GitHub app authorized from the Vercel dashboard's "Connect Git Repository" flow, a one-time manual step on GitHub's side).
