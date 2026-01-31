"use client";

import { type ServerEvent } from "@agent-arena/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWsEvents } from "@/hooks/useWsEvents";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useAuth } from "@/hooks/useAuth";

type Strategy = "hold" | "random" | "trend" | "mean_revert";
type Agent = {
  id: string;
  name: string;
  model: string;
  strategy: Strategy;
};

export function Lobby() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [agentsState, setAgentsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const { state, events, send } = useWsEvents();
  const auth = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAgentsState("loading");
      try {
        const base =
          process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        const res = await fetch(`${base}/agents`, { cache: "no-store" });
        if (!res.ok) {
          setAgents(null);
          setAgentsState("error");
          return;
        }
        const json = (await res.json()) as { agents: any[] };
        const list: Agent[] = (json.agents ?? []).map((a) => ({
          id: String(a.id),
          name: String(a.name),
          model: String(a.model),
          strategy: a.strategy as Strategy,
        }));
        if (cancelled) return;
        setAgents(list);
        setAgentsState("ready");
        if (!selectedAgentId && list.length > 0) setSelectedAgentId(list[0]!.id);
      } catch {
        if (cancelled) return;
        setAgents(null);
        setAgentsState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAgent = useMemo(() => {
    return agents?.find((a) => a.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

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

  const latestError = useMemo(() => {
    return events.find((e) => e.type === "error") as
      | Extract<ServerEvent, { type: "error" }>
      | undefined;
  }, [events]);

  const canJoin = state === "connected" && !!selectedAgent;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">Lobby</h2>
          <div className="text-sm text-muted-foreground">
            Status: {state} · Queue: {queue ? queue.queueSize : "—"}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ConnectWalletButton />
          <div className="flex items-center gap-3">
            {auth.isSignedIn ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Signed in
                </div>
                <button
                  type="button"
                  onClick={() => auth.signOut()}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={auth.state === "signing" || auth.state === "loading"}
                onClick={() => auth.signIn()}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
              >
                {auth.state === "signing" ? "Signing…" : "Sign in"}
              </button>
            )}
          </div>
          {auth.error ? (
            <div className="text-sm text-destructive-foreground/80">
              {auth.error}
            </div>
          ) : null}
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
            agentId: selectedAgent.id,
            agentName: selectedAgent.name,
            strategy: selectedAgent.strategy,
          });
        }}
      >
        <div className="md:col-span-3">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <label className="text-sm text-muted-foreground" htmlFor="agent">
                Agent
              </label>
              <div className="mt-1">
                {agentsState === "loading" ? (
                  <div className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    Loading agents…
                  </div>
                ) : agentsState === "error" ? (
                  <div className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    Agents unavailable. Start DB + API, then refresh.
                  </div>
                ) : agents && agents.length > 0 ? (
                  <select
                    id="agent"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.strategy} · {a.model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    No agents yet.
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/agents/new"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              New agent
            </Link>
          </div>
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

        {latestError ? (
          <div className="md:col-span-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            <div className="font-medium">{latestError.code}</div>
            <div className="mt-1 text-destructive-foreground/80">
              {latestError.message}
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
