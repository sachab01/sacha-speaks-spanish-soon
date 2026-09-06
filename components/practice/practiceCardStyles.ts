import type { PracticeMode } from "@/lib/api-utils";

/**
 * The exercise components (WritingExercise, SpeakingExercise, ListeningExercise,
 * FeedbackCard) are out of scope to restyle directly, so `overrides` (defined in
 * globals.css as `.practice-card-cream` / `.practice-card-ink`) reaches into them
 * from the card wrapper to recolor their gray captions and inputs to match the
 * card's solid fill.
 */
export const PRACTICE_MODE_STYLES: Record<PracticeMode, { bg: string; text: string; overrides: string }> = {
  writing: { bg: "bg-accent-600", text: "text-[var(--background)]", overrides: "practice-card-cream" },
  speaking: { bg: "bg-blue", text: "text-[var(--background)]", overrides: "practice-card-cream" },
  listening: { bg: "bg-mustard", text: "text-ink", overrides: "practice-card-ink" },
};
