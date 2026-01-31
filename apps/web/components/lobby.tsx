"use client";

import { type ServerEvent } from "@agent-arena/shared";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWsEvents } from "@/hooks/useWsEvents";

type Strategy = "hold" | "random" | "trend" | "mean_revert";

export function Lobby() {
  const [agentName, setAgentName] = useState("MyAgent");
  const [strategy, setStrategy] = useState<Strategy>("trend");
  const { state, events, send } = useWsEvents();

  const queue = useMemo(() => {
    return events.find((e) => e.type === "queue") as
      | Extract<ServerEvent, { type: "queue" }>
      | undefined;
  }, [events]);

  const match = useMemo(() => {
    return events.find((e) => e.type === "match_status") as
      | Extract<ServerEvent, { type: "match_status" }>
      | undefined;
  }, [events]);

  const canJoin = state === "connected" && agentName.trim().length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Lobby</h2>
        <div className="text-sm text-muted-foreground">
          Status: {state} · Queue: {queue ? queue.queueSize : "—"}
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canJoin) return;
          send({
            type: "join_queue",
            v: 1,
            agentName: agentName.trim(),
            strategy,
          });
        }}
      >
        <div className="md:col-span-2">
          <label className="text-sm text-muted-foreground" htmlFor="agentName">
            Agent name
          </label>
          <input
            id="agentName"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="MyAgent"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground" htmlFor="strategy">
            Strategy (demo)
          </label>
          <select
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="trend">trend</option>
            <option value="mean_revert">mean_revert</option>
            <option value="random">random</option>
            <option value="hold">hold</option>
          </select>
        </div>

        <div className="md:col-span-3 flex items-center justify-between">
          <button
            type="submit"
            disabled={!canJoin}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Join queue
          </button>

          {match ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/match/${match.matchId}`}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Live match ({match.phase})
              </Link>
              <Link
                href={`/replay/${match.matchId}`}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Replay
              </Link>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No match yet.</div>
          )}
        </div>
      </form>
    </section>
  );
}
