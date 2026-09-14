import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-[var(--background)]/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-6 py-4 md:px-12">
        <Link href="/" className="text-lg font-bold tracking-tight text-accent-600 dark:text-accent-400">
          SaSpSpSo
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link
            href="/progress"
            className="rounded-full bg-accent-600 px-4 py-1.5 font-bold text-[var(--background)] transition-colors hover:bg-accent-700"
          >
            Your skill
          </Link>
        </nav>
      </div>
    </header>
  );
}
