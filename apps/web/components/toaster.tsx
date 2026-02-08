"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Toast } from "@/components/toast-provider";
import { useToasts } from "@/components/toast-provider";

function variantClasses(variant: Toast["variant"]) {
  switch (variant) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10";
    case "error":
      return "border-destructive/30 bg-destructive/10";
    case "info":
    default:
      return "border-border bg-card";
  }
}

export function Toaster() {
  const { toasts, dismissToast } = useToasts();

  return (
    <div
      className="fixed right-4 top-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const durationMs = toast.durationMs ?? 7_500;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);

  const hasDetails = Boolean(toast.details && toast.details.trim().length > 0);
  const action = toast.action;

  const title = useMemo(() => toast.title.trim(), [toast.title]);
  const message = useMemo(() => toast.message.trim(), [toast.message]);

  useEffect(() => {
    if (hovered) return;
    timerRef.current = setTimeout(onDismiss, durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [durationMs, hovered, onDismiss]);

  return (
    <div
      role="status"
      className={`rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${variantClasses(
        toast.variant ?? "info",
      )}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{message}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-full border border-border bg-background/40 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          Close
        </button>
      </div>

      {action ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void action.onClick()}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {action.label}
          </button>
        </div>
      ) : null}

      {hasDetails ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Show details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-border bg-background/40 p-2 text-[11px] leading-snug text-foreground/90">
            {toast.details}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

