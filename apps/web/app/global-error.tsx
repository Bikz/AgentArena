"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const showDetails =
    process.env.NEXT_PUBLIC_SHOW_ERROR_DETAILS === "1" ||
    process.env.NODE_ENV !== "production";

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">App error</h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error. Please reload.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reload
            </button>
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
      </body>
    </html>
  );
}

