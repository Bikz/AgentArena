"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep minimal: Vercel/Next runtime logs are the source of truth.
    console.error(error);
  }, [error]);

  const showDetails =
    process.env.NEXT_PUBLIC_SHOW_ERROR_DETAILS === "1" ||
    process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page hit an unexpected error. Please try again.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload
        </button>
        <Link
          href="/"
          className="rounded-full border border-border bg-background px-5 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          Go home
        </Link>
      </div>

      {showDetails ? (
        <details className="mt-4 rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Show details
          </summary>
          <pre className="mt-3 overflow-auto text-xs text-foreground/90">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      ) : null}
    </main>
  );
}
