"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TopicCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instructions: instructions.trim() || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create topic");
      }
      setName("");
      setInstructions("");
      router.push(`/topics/${data.topic.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="topic-name" className="sr-only">
          Topic title
        </label>
        <input
          id="topic-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Title — e.g. ordering food at a restaurant"
          disabled={isSubmitting}
          maxLength={200}
          className="w-full rounded-full border border-accent-300 bg-[var(--background)] px-4 py-2 text-sm font-bold text-accent-600 outline-accent-500 focus:border-accent-500 dark:border-accent-800"
        />
      </div>
      <div>
        <label htmlFor="topic-instructions" className="sr-only">
          What kinds of words do you want? (optional)
        </label>
        <textarea
          id="topic-instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="What kinds of words do you want? (optional) — e.g. focus on formal/usted phrasing, or verbs for giving directions"
          disabled={isSubmitting}
          maxLength={1000}
          rows={2}
          className="w-full rounded-2xl border border-accent-300 bg-[var(--background)] px-4 py-2 text-sm font-bold text-accent-600 outline-accent-500 focus:border-accent-500 dark:border-accent-800"
        />
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || name.trim().length === 0}
        className="self-start rounded-full bg-accent-600 px-5 py-2 text-sm font-bold text-[var(--background)] transition-colors hover:bg-accent-700 disabled:opacity-50"
      >
        {isSubmitting ? "Building bank…" : "Create topic"}
      </button>
    </form>
  );
}
