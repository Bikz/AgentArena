"use client";

import { useCallback, useEffect, useState } from "react";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";

type State = "idle" | "copying" | "copied" | "error";

export function ShareLinkButton({
  path,
  label = "Copy link",
}: {
  path: string;
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const { pushToast } = useToasts();

  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const handleCopy = useCallback(async () => {
    setState("copying");
    try {
      const url = new URL(path, window.location.origin).toString();
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setState("copied");
      pushToast({
        title: "Link copied",
        message: "Copied to clipboard.",
        variant: "success",
        dedupeKey: `clipboard:copied:${path}`,
        dedupeWindowMs: 2000,
      });
    } catch (err) {
      setState("error");
      const n = normalizeError(err, { feature: "copy_link" });
      pushToast({
        title: n.title,
        message: n.message,
        details: n.details,
        variant: n.variant,
        dedupeKey: `clipboard:error:${n.title}:${n.message}`,
        dedupeWindowMs: 10_000,
      });
    }
  }, [path, pushToast]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCopy}
        disabled={state === "copying"}
        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
      >
        {state === "copied" ? "Copied" : state === "copying" ? "Copying…" : label}
      </button>
    </div>
  );
}
