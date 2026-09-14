"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";

export type DropdownOption = {
  value: string;
  label: string;
  description?: string;
  href: string;
};

/**
 * A link-based dropdown menu: each option navigates via its own href rather
 * than firing a callback, so the selector works the same as a plain nav link
 * (shareable URL, no client state to keep in sync with the route).
 */
export function Dropdown({
  label,
  options,
  current,
  inverted = false,
}: {
  /** Shown beside the selected option's label; or, with no matching option, as the trigger's own text (an action menu like "Practice ▾"). */
  label?: string;
  options: DropdownOption[];
  current: string;
  /** Use light (background-colored) trigger text/border for placement on a solid accent-colored surface. */
  inverted?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentOption = options.find((option) => option.value === current);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={
          inverted
            ? "flex items-center gap-1.5 border-b border-current/50 pb-0.5 text-sm font-bold text-current transition-colors hover:border-current"
            : "flex items-center gap-1.5 border-b border-accent-300 pb-0.5 text-sm font-bold text-accent-600 transition-colors hover:border-accent-500 hover:text-accent-700 dark:border-accent-700 dark:text-accent-400 dark:hover:border-accent-500 dark:hover:text-accent-300"
        }
      >
        {currentOption ? (
          <>
            {label && <span className={inverted ? "text-current opacity-80" : "text-accent-500"}>{label}</span>}
            <span className="font-bold">{currentOption.label}</span>
          </>
        ) : (
          <span className="font-bold">{label}</span>
        )}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 z-20 mt-2 w-64 overflow-hidden border border-accent-200 bg-[var(--background)] p-1 shadow-lg dark:border-accent-900"
        >
          {options.map((option) => {
            const isSelected = option.value === current;
            return (
              <Link
                key={option.value}
                href={option.href}
                role="option"
                aria-selected={isSelected}
                onClick={() => setIsOpen(false)}
                className={`flex items-start justify-between gap-2 px-3 py-2 text-sm font-bold transition-colors ${
                  isSelected
                    ? "text-accent-600 dark:text-accent-400"
                    : "text-accent-700 hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-950/40"
                }`}
              >
                <span>
                  <span className="block font-bold">{option.label}</span>
                  {option.description && (
                    <span className="block text-xs font-bold text-accent-500">{option.description}</span>
                  )}
                </span>
                {isSelected && <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
