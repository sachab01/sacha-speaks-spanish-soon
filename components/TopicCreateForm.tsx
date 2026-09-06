"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TopicCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create topic");
      }
      setName("");
      router.push(`/topics/${data.topic.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor="topic-name" className="sr-only">
          Topic
        </label>
        <input
          id="topic-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. ordering food at a restaurant"
          disabled={isSubmitting}
          maxLength={200}
          className="w-full rounded-full border border-accent-300 bg-[var(--background)] px-4 py-2 text-sm font-bold text-accent-600 outline-accent-500 focus:border-accent-500 dark:border-accent-800"
        />
        {error && <p className="mt-1 text-sm font-bold text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting || name.trim().length === 0}
        className="rounded-full bg-accent-600 px-5 py-2 text-sm font-bold text-[var(--background)] transition-colors hover:bg-accent-700 disabled:opacity-50"
      >
        {isSubmitting ? "Building bank…" : "Create topic"}
      </button>
    </form>
  );
}
