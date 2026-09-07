"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopicDeleteButton({ topicId, topicName }: { topicId: number; topicName: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete the topic");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="shrink-0 text-sm font-bold text-accent-500 transition-colors hover:text-red-600"
      >
        Delete topic
      </button>

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-red-300 bg-[var(--background)] p-5 dark:border-red-900">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">
              Delete &ldquo;{topicName}&rdquo;? This permanently removes the topic and its practice history. Words
              already learned here stay available if they&rsquo;re also used by another topic. This can&rsquo;t be
              undone.
            </p>
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isDeleting}
                className="rounded-full border border-accent-300 px-4 py-1.5 text-sm font-bold text-accent-600 transition-colors hover:bg-accent-50 disabled:opacity-50 dark:border-accent-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
