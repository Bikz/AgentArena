"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type ToastInput = {
  title: string;
  message: string;
  variant?: ToastVariant;
  details?: string;
  action?: ToastAction;
  durationMs?: number;
  dedupeKey?: string;
  dedupeWindowMs?: number;
};

export type Toast = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastContextValue = {
  toasts: Toast[];
  pushToast: (input: ToastInput) => string | null;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function now() {
  return Date.now();
}

function id() {
  return `toast-${crypto.randomUUID()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastByDedupeKeyRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const createdAt = now();

    if (input.dedupeKey) {
      const lastAt = lastByDedupeKeyRef.current.get(input.dedupeKey);
      const windowMs = input.dedupeWindowMs ?? 30_000;
      if (lastAt && createdAt - lastAt < windowMs) return null;
      lastByDedupeKeyRef.current.set(input.dedupeKey, createdAt);
    }

    const toast: Toast = {
      id: id(),
      createdAt,
      title: input.title,
      message: input.message,
      variant: input.variant ?? "info",
      details: input.details,
      action: input.action,
      durationMs: input.durationMs ?? 7_500,
      dedupeKey: input.dedupeKey,
      dedupeWindowMs: input.dedupeWindowMs,
    };

    setToasts((prev) => [toast, ...prev].slice(0, 5));
    return toast.id;
  }, []);

  const value = useMemo<ToastContextValue>(() => {
    return { toasts, pushToast, dismissToast, clearToasts };
  }, [toasts, pushToast, dismissToast, clearToasts]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within <ToastProvider>");
  return ctx;
}

