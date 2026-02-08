"use client";

import { HttpError } from "@/lib/http";

export type ErrorContext = {
  feature?: string;
  url?: string;
  status?: number;
  requestId?: string | null;
  ws?: { attempt?: number; closeCode?: number; closeReason?: string };
};

export type NormalizedError = {
  title: string;
  message: string;
  details?: string;
  variant: "info" | "warning" | "error";
  retryable: boolean;
};

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function rawMessage(err: unknown) {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  return safeStringify(err);
}

function includes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function normalizeError(err: unknown, ctx?: ErrorContext): NormalizedError {
  const msg = rawMessage(err);

  // Wallet / wagmi / viem common strings.
  if (includes(msg, "connection request reset")) {
    return {
      title: "Wallet connection",
      message: "Wallet connection was cancelled or reset. Open your wallet and try again.",
      details: [msg, ctx?.feature ? `feature: ${ctx.feature}` : null].filter(Boolean).join("\n\n"),
      variant: "warning",
      retryable: true,
    };
  }

  if (includes(msg, "user rejected") || includes(msg, "userrejectedrequesterror")) {
    return {
      title: "Request cancelled",
      message: "You cancelled the request.",
      details: [msg, ctx?.feature ? `feature: ${ctx.feature}` : null].filter(Boolean).join("\n\n"),
      variant: "info",
      retryable: true,
    };
  }

  if (includes(msg, "provider not found") || includes(msg, "no ethereum provider")) {
    return {
      title: "Wallet not found",
      message: "No browser wallet found. Use WalletConnect to connect.",
      details: [msg, ctx?.feature ? `feature: ${ctx.feature}` : null].filter(Boolean).join("\n\n"),
      variant: "warning",
      retryable: true,
    };
  }

  // HTTP errors.
  if (err instanceof HttpError) {
    const requestId = err.requestId ?? ctx?.requestId ?? null;
    const details = [
      `url: ${err.url}`,
      `status: ${err.status}`,
      requestId ? `requestId: ${requestId}` : null,
      err.bodyJson ? `bodyJson:\n${safeStringify(err.bodyJson)}` : null,
      err.bodyText ? `bodyText:\n${err.bodyText}` : null,
      ctx?.feature ? `feature: ${ctx.feature}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (err.status === 401) {
      return {
        title: "Sign-in required",
        message: "Please connect your wallet and sign in to continue.",
        details,
        variant: "warning",
        retryable: true,
      };
    }
    if (err.status >= 500) {
      return {
        title: "Server error",
        message: "Server error. Try again in a moment.",
        details,
        variant: "error",
        retryable: true,
      };
    }
    return {
      title: "Request failed",
      message: "Request failed. Please try again.",
      details,
      variant: "error",
      retryable: true,
    };
  }

  // WebSocket / network-ish.
  if (ctx?.ws) {
    const details = [
      msg,
      ctx.ws.attempt != null ? `attempt: ${ctx.ws.attempt}` : null,
      ctx.ws.closeCode != null ? `closeCode: ${ctx.ws.closeCode}` : null,
      ctx.ws.closeReason ? `closeReason: ${ctx.ws.closeReason}` : null,
      ctx.feature ? `feature: ${ctx.feature}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: "Live updates",
      message: "Live updates disconnected. Reconnecting…",
      details,
      variant: "warning",
      retryable: true,
    };
  }

  if (includes(msg, "failed to fetch") || includes(msg, "networkerror")) {
    return {
      title: "Network error",
      message: "Network error. Check your connection and try again.",
      details: [msg, ctx?.feature ? `feature: ${ctx.feature}` : null].filter(Boolean).join("\n\n"),
      variant: "warning",
      retryable: true,
    };
  }

  return {
    title: "Something went wrong",
    message: "Something went wrong. Please try again.",
    details: [msg, ctx?.feature ? `feature: ${ctx.feature}` : null].filter(Boolean).join("\n\n"),
    variant: "error",
    retryable: true,
  };
}

