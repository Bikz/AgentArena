"use client";

import { type ServerEvent } from "@agent-arena/shared";
import { useMemo } from "react";
import { useWsEvents } from "@/hooks/useWsEvents";

export function LiveDemo() {
  const { state, events } = useWsEvents();

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

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Connection</div>
          <div className="mt-2 text-lg font-medium">
            {state === "connected" ? "Live" : state}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            WebSocket:{" "}
            {process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:3001/ws"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">BTC Price (demo)</div>
          <div className="mt-2 text-lg font-medium">
            {latestTick ? `$${latestTick.tick.btcPrice.toFixed(2)}` : "—"}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Tick: {latestTick ? latestTick.tick.tick : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Match</div>
          <div className="mt-2 text-lg font-medium">demo</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Updates stream in real-time.
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">Leaderboard (demo)</h2>
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
                </tr>
              </thead>
              <tbody>
                {latestLeaderboard.rows
                  .slice()
                  .sort((a, b) => b.credits - a.credits)
                  .map((row, idx) => (
                    <tr key={row.seatId} className="border-t border-border">
                      <td className="py-2 pr-4">{idx + 1}</td>
                      <td className="py-2 pr-4">{row.agentName}</td>
                      <td className="py-2 pr-4">{row.credits.toFixed(2)}</td>
                      <td className="py-2 pr-4">{row.target.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-muted-foreground">
              Waiting for leaderboard events…
            </div>
          )}
        </div>
      </section>
    </>
  );
}

