"use client";

import {
  ClientEventSchema,
  ServerEventSchema,
  type ClientEvent,
  type ServerEvent,
} from "@agent-arena/shared";
import { useEffect, useRef, useState } from "react";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";

type WsState = "connecting" | "connected" | "disconnected" | "error";

export function useWsEvents(options?: {
  onOpenSend?: ClientEvent[];
}) {
  const [state, setState] = useState<WsState>("connecting");
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [wsStatus, setWsStatus] = useState<{
    attempt: number;
    lastClose: { code: number; reason: string } | null;
  }>({ attempt: 0, lastClose: null });
  const { pushToast } = useToasts();
  const socketRef = useRef<WebSocket | null>(null);
  const outboundQueueRef = useRef<string[]>([]);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCloseRef = useRef<{ code: number; reason: string } | null>(null);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;

      setState((s) => (s === "connected" ? s : "connecting"));

      const base =
        process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:3001/ws";
      const url = new URL(base);
      url.searchParams.set("clientId", `web-${crypto.randomUUID()}`);
      const wsUrl = url.toString();

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        retryRef.current = 0;
        setState("connected");
        lastCloseRef.current = null;
        setWsStatus({ attempt: 0, lastClose: null });

        // Resend initial messages (e.g. subscribe) on each successful connect.
        for (const msg of options?.onOpenSend ?? []) {
          if (!ClientEventSchema.safeParse(msg).success) continue;
          socket.send(JSON.stringify(msg));
        }

        // Flush queued messages.
        const queue = outboundQueueRef.current;
        outboundQueueRef.current = [];
        for (const payload of queue) socket.send(payload);
      });

      socket.addEventListener("close", (ev) => {
        if (closed) return;
        setState("disconnected");

        const attempt = Math.min(6, retryRef.current + 1);
        retryRef.current = attempt;
        const delay = Math.min(5000, 250 * 2 ** (attempt - 1));

        const code = typeof ev.code === "number" ? ev.code : 0;
        const reason = typeof ev.reason === "string" ? ev.reason : "";
        const last = lastCloseRef.current;
        lastCloseRef.current = { code, reason };
        setWsStatus({ attempt, lastClose: { code, reason } });

        // Only toast after a few failed attempts, and dedupe.
        if (attempt >= 3) {
          const n = normalizeError(
            new Error("WebSocket disconnected"),
            {
              feature: "ws",
              ws: { attempt, closeCode: code, closeReason: reason },
            },
          );
          pushToast({
            title: n.title,
            message: n.message,
            details: n.details,
            variant: n.variant,
            dedupeKey: `ws:${code}:${reason}:${attempt}:${last?.code ?? ""}:${last?.reason ?? ""}`,
            dedupeWindowMs: 30_000,
          });
        }

        reconnectTimerRef.current = setTimeout(connect, delay);
      });

      socket.addEventListener("error", () => {
        if (closed) return;
        setState("error");
        // Let the close handler schedule reconnect.
      });

      socket.addEventListener("message", (msg) => {
        try {
          const json = JSON.parse(msg.data as string);
          const parsed = ServerEventSchema.safeParse(json);
          if (!parsed.success) return;
          setEvents((prev) => [parsed.data, ...prev].slice(0, 200));
        } catch {
          // ignore
        }
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const socket = socketRef.current;
      if (socket) socket.close();
      socketRef.current = null;
    };
  }, [options?.onOpenSend, pushToast]);

  const send = (msg: ClientEvent) => {
    const socket = socketRef.current;
    const parsed = ClientEventSchema.safeParse(msg);
    if (!parsed.success) return false;

    const payload = JSON.stringify(parsed.data);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      outboundQueueRef.current.push(payload);
      return false;
    }
    socket.send(payload);
    return true;
  };

  return { state, events, send, wsStatus };
}
