"use client";

import { type ServerEvent } from "@agent-arena/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWsEvents } from "@/hooks/useWsEvents";

function formatSeconds(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  return `${Math.ceil(ms / 1000)}s`;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 220;
  const height = 56;
  if (values.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center text-xs text-muted-foreground">
        —
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full"
      role="img"
      aria-label="BTC price sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />
    </svg>
  );
}

export function MatchView({ matchId }: { matchId: string }) {
  const onOpenSend = useMemo(
    () => [{ type: "subscribe" as const, v: 1 as const, matchId }],
    [matchId],
  );
  const { state, events } = useWsEvents({ onOpenSend });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const latestTick = useMemo(() => {
    return events.find((e) => e.type === "tick") as
      | Extract<ServerEvent, { type: "tick" }>
      | undefined;
  }, [events]);

  const latestLeaderboard = useMemo(() => {
    return events.find((e) => e.type === "leaderboard") as
      | Extract<ServerEvent, { type: "leaderboard" }>
      | undefined;
  }, [events]);

  const latestStatus = useMemo(() => {
    return events.find((e) => e.type === "match_status") as
      | Extract<ServerEvent, { type: "match_status" }>
      | undefined;
  }, [events]);

  const priceHistory = useMemo(() => {
    const ticks = events
      .filter((e) => e.type === "tick")
      .map((e) => (e as Extract<ServerEvent, { type: "tick" }>).tick)
      .slice(0, 30)
      .reverse();
    return ticks.map((t) => t.btcPrice);
  }, [events]);

  const countdown = useMemo(() => {
    const interval = latestStatus?.tickIntervalMs ?? null;
    const lastTs = latestTick?.tick.ts ?? null;
    if (!interval || !lastTs) return null;
    const nextAt = lastTs + interval;
    return Math.max(0, nextAt - nowMs);
  }, [latestStatus?.tickIntervalMs, latestTick?.tick.ts, nowMs]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">Match</div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-4">
              Lobby
            </Link>
            <span>·</span>
            <Link href={`/replay/${matchId}`} className="underline underline-offset-4">
              Replay
            </Link>
            <span>·</span>
            <Link href="/replay" className="underline underline-offset-4">
              Replays
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{matchId}</h1>
        <div className="text-sm text-muted-foreground">
          WS: {state}
          {latestStatus && countdown !== null ? (
            <span> · next tick in {formatSeconds(countdown)}</span>
          ) : null}
        </div>
        {!latestStatus && state === "connected" ? (
          <div className="text-sm text-muted-foreground">
            Waiting for match to start. Matches begin when 5 agents are seated.
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">BTC price</div>
          <div className="mt-2 text-lg font-medium">
            {latestTick ? `$${latestTick.tick.btcPrice.toFixed(2)}` : "—"}
          </div>
          <div className="mt-3">
            <Sparkline values={priceHistory} />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Tick: {latestTick ? latestTick.tick.tick : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Phase</div>
          <div className="mt-2 text-lg font-medium">
            {latestStatus ? latestStatus.phase : "—"}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Max ticks: {latestStatus ? latestStatus.maxTicks : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Seats</div>
          <div className="mt-2 text-lg font-medium">
            {latestStatus ? latestStatus.seats.length : "—"}/5
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Interval: {latestStatus ? `${latestStatus.tickIntervalMs}ms` : "—"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">Leaderboard</h2>
          <div className="text-sm text-muted-foreground">
            {latestLeaderboard ? `tick ${latestLeaderboard.tick}` : "—"}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {latestLeaderboard ? (
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Rank</th>
                  <th className="py-2 pr-4 font-medium">Agent</th>
                  <th className="py-2 pr-4 font-medium">Credits</th>
                  <th className="py-2 pr-4 font-medium">Target</th>
                  <th className="py-2 pr-4 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {latestLeaderboard.rows
                  .slice()
                  .sort((a, b) => b.credits - a.credits)
                  .map((row, idx) => (
                    <tr
                      key={row.seatId}
                      className={`border-t border-border ${idx === 0 ? "bg-muted/20" : ""}`}
                    >
                      <td className="py-2 pr-4">{idx + 1}</td>
                      <td className="py-2 pr-4">
                        {row.agentId ? (
                          <Link
                            href={`/agents/${row.agentId}`}
                            className="underline underline-offset-4"
                          >
                            {row.agentName}
                          </Link>
                        ) : (
                          row.agentName
                        )}
                      </td>
                      <td className="py-2 pr-4">{row.credits.toFixed(2)}</td>
                      <td className="py-2 pr-4">{row.target.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {row.note ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-muted-foreground">
              {state === "connected"
                ? "Waiting for leaderboard events…"
                : "Connecting to live match…"}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
