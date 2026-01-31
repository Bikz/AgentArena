"use client";

import { ServerEventSchema, type ServerEvent } from "@agent-arena/shared";
import { useEffect, useRef, useState } from "react";

type WsState = "connecting" | "connected" | "disconnected" | "error";

export function useWsEvents() {
  const [state, setState] = useState<WsState>("connecting");
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:3001/ws";
    const url = new URL(base);
    url.searchParams.set("clientId", `web-${crypto.randomUUID()}`);
    const wsUrl = url.toString();

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => setState("connected"));
    socket.addEventListener("close", () => setState("disconnected"));
    socket.addEventListener("error", () => setState("error"));
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

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return { state, events };
}
