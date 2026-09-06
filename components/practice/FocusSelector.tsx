import Link from "next/link";

const FOCUS_OPTIONS = [
  { value: "due", label: "Due" },
  { value: "weakest", label: "Weakest words" },
  { value: "stale", label: "Not reviewed in a while" },
] as const;

export function FocusSelector({ basePath, current }: { basePath: string; current: string }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {FOCUS_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={option.value === "due" ? basePath : `${basePath}?focus=${option.value}`}
          className={
            current === option.value
              ? "rounded-md bg-neutral-900 px-3 py-1.5 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded-md border border-neutral-300 px-3 py-1.5 hover:border-neutral-500 dark:border-neutral-700"
          }
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
