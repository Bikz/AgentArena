"use client";

import { useCallback, useEffect, useState } from "react";

type State = "idle" | "copying" | "copied" | "error";

export function ShareLinkButton({
  path,
  label = "Copy link",
}: {
  path: string;
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const handleCopy = useCallback(async () => {
    setState("copying");
    setError(null);
    try {
      const url = new URL(path, window.location.origin).toString();
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to copy link.");
    }
  }, [path]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCopy}
        disabled={state === "copying"}
        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {state === "copied" ? "Copied" : state === "copying" ? "Copying…" : label}
      </button>
      {state === "error" && error ? (
        <div className="text-xs text-destructive-foreground/80">{error}</div>
      ) : null}
    </div>
  );
}
