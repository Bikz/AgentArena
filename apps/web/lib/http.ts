"use client";

export class HttpError extends Error {
  status: number;
  url: string;
  requestId: string | null;
  bodyText: string | null;
  bodyJson: unknown | null;

  constructor(args: {
    message: string;
    status: number;
    url: string;
    requestId: string | null;
    bodyText: string | null;
    bodyJson: unknown | null;
  }) {
    super(args.message);
    this.name = "HttpError";
    this.status = args.status;
    this.url = args.url;
    this.requestId = args.requestId;
    this.bodyText = args.bodyText;
    this.bodyJson = args.bodyJson;
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true; data: T; requestId: string | null }> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.headers ?? {}),
        accept: "application/json",
      },
    });

    const requestId = res.headers.get("x-request-id");

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    let bodyJson: unknown | null = null;
    let bodyText: string | null = null;

    try {
      if (isJson) bodyJson = await res.json();
      else bodyText = await res.text();
    } catch {
      // ignore parse errors; we still have status + request id
    }

    if (!res.ok) {
      const message =
        (typeof bodyJson === "object" &&
        bodyJson &&
        "error" in bodyJson &&
        typeof (bodyJson as any).error === "string"
          ? (bodyJson as any).error
          : null) ??
        bodyText ??
        `HTTP ${res.status}`;

      throw new HttpError({
        message,
        status: res.status,
        url,
        requestId,
        bodyText,
        bodyJson,
      });
    }

    return { ok: true, data: bodyJson as T, requestId };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

