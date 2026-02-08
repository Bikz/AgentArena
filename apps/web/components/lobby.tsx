"use client";

import { type ServerEvent } from "@agent-arena/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWsEvents } from "@/hooks/useWsEvents";
import { useAuth } from "@/hooks/useAuth";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";
import { fetchJson } from "@/lib/http";

type Strategy = "hold" | "random" | "trend" | "mean_revert";
type QueueState = "idle" | "queued" | "seated";
type Agent = {
  id: string;
  name: string;
  model: string;
  strategy: Strategy;
  ens_name?: string | null;
};

export function Lobby() {
  const { pushToast } = useToasts();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [agentsState, setAgentsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [manualAgentName, setManualAgentName] = useState<string>("Guest");
  const [manualStrategy, setManualStrategy] = useState<Strategy>("hold");
  const [paidMatches, setPaidMatches] = useState<boolean>(false);
  const [entry, setEntry] = useState<{ asset: string; amount: string } | null>(
    null,
  );
  const [tickFee, setTickFee] = useState<{ asset: string; amount: string } | null>(
    null,
  );
  const [matchConfig, setMatchConfig] = useState<{
    tickIntervalMs: number;
    maxTicks: number;
    startPrice: number;
  } | null>(null);
  const [onchainConfig, setOnchainConfig] = useState<{
    enabled: boolean;
    token: string | null;
    contract: string | null;
    rakeBps: number | null;
  } | null>(null);
  const [status, setStatus] = useState<{
    db: { configured: boolean };
    ai?: { enabled: boolean };
    yellow: {
      configured: boolean;
      paidMatches: boolean;
      houseConfigured: boolean;
      sessionPersistence: boolean;
    };
    demo?: { allowBots: boolean };
    onchain?: {
      enabled: boolean;
      contractAddress: string | null;
      tokenAddress: string | null;
      houseAddress: string | null;
    };
  } | null>(null);
  const [queueState, setQueueState] = useState<QueueState>("idle");
  const [queuedAgent, setQueuedAgent] = useState<{
    id?: string;
    name: string;
    strategy: Strategy;
  } | null>(null);
  const [seatedMatchId, setSeatedMatchId] = useState<string | null>(null);
  const [yellowReady, setYellowReady] = useState<boolean>(false);
  const [demoState, setDemoState] = useState<"idle" | "loading" | "error">("idle");
  const [demoError, setDemoError] = useState<string | null>(null);

  const { state, events, send } = useWsEvents();
  const auth = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const base =
          process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        const { data: json } = await fetchJson<{
          paidMatches: boolean;
          entry: { asset: string; amount: string };
          tickFee?: { asset: string; amount: string };
          match?: { tickIntervalMs: number; maxTicks: number; startPrice: number };
          onchain?: {
            enabled: boolean;
            token: string | null;
            contract: string | null;
            rakeBps: number | null;
          };
        }>(`${base}/config`, { cache: "no-store" }, { timeoutMs: 10_000 });
        if (cancelled) return;
        setPaidMatches(Boolean(json.paidMatches));
        setEntry(json.entry ?? null);
        setTickFee(json.tickFee ?? null);
        setMatchConfig(json.match ?? null);
        setOnchainConfig(json.onchain ?? null);
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const base =
          process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        const { data: json } = await fetchJson<any>(
          `${base}/status`,
          { cache: "no-store" },
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setStatus(json ?? null);
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!auth.isSignedIn) {
        setYellowReady(false);
        return;
      }
      try {
        const base =
          process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        await fetchJson(`${base}/yellow/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        setYellowReady(true);
      } catch {
        if (cancelled) return;
        setYellowReady(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [auth.isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAgentsState("loading");
      try {
        const base =
          process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        const { data: json } = await fetchJson<{ agents: any[] }>(
          `${base}/agents`,
          { cache: "no-store" },
          { timeoutMs: 15_000 },
        );
        const list: Agent[] = (json.agents ?? []).map((a) => ({
          id: String(a.id),
          name: String(a.name),
          model: String(a.model),
          strategy: a.strategy as Strategy,
          ens_name: (a as any).ens_name ?? null,
        }));
        if (cancelled) return;
        setAgents(list);
        setAgentsState("ready");
        if (!selectedAgentId && list.length > 0) setSelectedAgentId(list[0]!.id);
      } catch (err) {
        if (cancelled) return;
        setAgents(null);
        setAgentsState("error");
        const n = normalizeError(err, { feature: "agents_list" });
        pushToast({
          title: n.title,
          message: "Couldn’t load agents. Refresh and try again.",
          details: n.details,
          variant: "warning",
          dedupeKey: "agents:list",
          dedupeWindowMs: 30_000,
        });
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
  const hasManualAgent = manualAgentName.trim().length > 0;

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

  const canJoin =
    state === "connected" &&
    (!!selectedAgent || hasManualAgent) &&
    auth.isSignedIn &&
    (!paidMatches || yellowReady) &&
    queueState === "idle";

  useEffect(() => {
    if (!auth.isSignedIn) {
      setQueueState("idle");
      setQueuedAgent(null);
      setSeatedMatchId(null);
    }
  }, [auth.isSignedIn]);

  useEffect(() => {
    if (state === "connected") return;
    if (queueState === "queued") {
      setQueueState("idle");
      setQueuedAgent(null);
      setSeatedMatchId(null);
    }
  }, [queueState, state]);

  useEffect(() => {
    if (!match || !queuedAgent) return;
    const isSeated = match.seats.some((seat) =>
      queuedAgent.id ? seat.agentId === queuedAgent.id : seat.agentName === queuedAgent.name,
    );
    if (isSeated) {
      setQueueState("seated");
      setSeatedMatchId(match.matchId);
      return;
    }
    if (
      queueState === "seated" &&
      seatedMatchId === match.matchId &&
      match.phase === "finished"
    ) {
      setQueueState("idle");
      setQueuedAgent(null);
      setSeatedMatchId(null);
    }
  }, [match, queuedAgent, queueState, seatedMatchId]);

  useEffect(() => {
    if (!latestError) return;
    if (queueState !== "queued") return;
    const retryableCodes = new Set([
      "UNAUTHORIZED",
      "YELLOW_NOT_READY",
      "HOUSE_NOT_CONFIGURED",
      "ENTRY_FEE_FAILED",
      "AGENT_NOT_FOUND",
      "FORBIDDEN",
      "ALREADY_QUEUED",
    ]);
    if (retryableCodes.has(latestError.code)) {
      setQueueState("idle");
      setQueuedAgent(null);
      setSeatedMatchId(null);
    }
  }, [latestError, queueState]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Queue
          </div>
          <h2 className="text-base font-medium">Join the next match</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            {queue ? `${queue.queueSize}/5 seats filled` : "Queue unavailable"} · WS {state}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-muted/40 px-2 py-1">
            {auth.isSignedIn ? "Signed in" : "Sign in to join"}
          </span>
          {status?.demo?.allowBots ? (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-1">
              Demo bots on
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          Entry: {paidMatches ? `${entry?.amount ?? "—"} ${entry?.asset ?? ""}` : "Free"}
          {paidMatches ? " (base units)" : ""}
        </div>
        <div>
          Tick: {matchConfig ? Math.round(matchConfig.tickIntervalMs / 1000) : "—"}s ·{" "}
          {matchConfig?.maxTicks ?? "—"} ticks
        </div>
        <div>
          Start price: {matchConfig ? `$${Number(matchConfig.startPrice).toLocaleString()}` : "—"}
        </div>
        <div>
          Settlement: {onchainConfig?.enabled ? "On-chain + Yellow" : "Yellow session"}
        </div>
        {paidMatches && tickFee && tickFee.amount !== "0" ? (
          <div className="sm:col-span-2">
            Tick fee: {tickFee.amount} {tickFee.asset} (per seat per tick)
          </div>
        ) : null}
      </div>

      <form
        className="mt-5 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canJoin) return;
          if (selectedAgent) {
            send({
              type: "join_queue",
              v: 1,
              agentId: selectedAgent.id,
              agentName: selectedAgent.name,
              strategy: selectedAgent.strategy,
            });
            setQueueState("queued");
            setQueuedAgent({
              id: selectedAgent.id,
              name: selectedAgent.name,
              strategy: selectedAgent.strategy,
            });
            setSeatedMatchId(null);
            return;
          }
          if (!hasManualAgent) return;
          send({
            type: "join_queue",
            v: 1,
            agentName: manualAgentName.trim(),
            strategy: manualStrategy,
          });
          setQueueState("queued");
          setQueuedAgent({
            name: manualAgentName.trim(),
            strategy: manualStrategy,
          });
          setSeatedMatchId(null);
        }}
      >
        {status ? (
          <div className="md:col-span-3 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>DB: {status.db.configured ? "on" : "off"}</span>
              <span>Yellow: {status.yellow.configured ? "on" : "off"}</span>
              {status.ai ? <span>AI: {status.ai.enabled ? "on" : "off"}</span> : null}
              {status.onchain ? (
                <span>On-chain: {status.onchain.enabled ? "on" : "off"}</span>
              ) : null}
              {status.onchain?.enabled && !status.onchain.contractAddress ? (
                <span className="text-destructive-foreground/80">
                  Contract missing.
                </span>
              ) : null}
              {status.yellow.paidMatches && !status.yellow.houseConfigured ? (
                <span className="text-destructive-foreground/80">
                  House wallet missing.
                </span>
              ) : null}
              {status.yellow.paidMatches && !status.yellow.sessionPersistence ? (
                <span>
                  Tip: set{" "}
                  <span className="font-mono">YELLOW_SESSION_STORE_KEY_BASE64</span>.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

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
                        {a.ens_name ? `${a.ens_name} · ` : ""}
                        {a.name} · {a.strategy} · {a.model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor="manual-agent">
                        Agent name
                      </label>
                      <input
                        id="manual-agent"
                        value={manualAgentName}
                        onChange={(e) => setManualAgentName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Guest"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground" htmlFor="manual-strategy">
                        Strategy
                      </label>
                      <select
                        id="manual-strategy"
                        value={manualStrategy}
                        onChange={(e) => setManualStrategy(e.target.value as Strategy)}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="hold">hold</option>
                        <option value="random">random</option>
                        <option value="trend">trend</option>
                        <option value="mean_revert">mean_revert</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 text-xs text-muted-foreground">
                      Quick-join works without a DB. Create a saved agent for ENS + prompt
                      tracking.
                    </div>
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
        <div className="md:col-span-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canJoin}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {queueState === "queued"
                ? "Queued"
                : queueState === "seated"
                  ? "Seated"
                  : paidMatches && !yellowReady
                    ? "Enable Yellow to join"
                    : "Join queue"}
            </button>
            {queueState === "queued" ? (
              <button
                type="button"
                onClick={() => {
                  send({ type: "leave_queue", v: 1 });
                  setQueueState("idle");
                  setQueuedAgent(null);
                  setSeatedMatchId(null);
                }}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/40"
              >
                Leave queue
              </button>
            ) : null}
            {status?.demo?.allowBots && queueState === "idle" ? (
              <button
                type="button"
                disabled={demoState === "loading"}
                onClick={async () => {
                  setDemoState("loading");
                  setDemoError(null);
                  try {
                    const base =
                      process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
                    await fetchJson<{ ok: true }>(`${base}/demo/fill`, {
                      method: "POST",
                      cache: "no-store",
                    });
                    setDemoState("idle");
                  } catch (err) {
                    const n = normalizeError(err, { feature: "demo_fill" });
                    setDemoState("error");
                    setDemoError(n.message);
                    pushToast({
                      title: n.title,
                      message: n.message,
                      details: n.details,
                      variant: n.variant,
                      dedupeKey: `demo:fill:${n.title}:${n.message}`,
                      dedupeWindowMs: 15_000,
                    });
                  }
                }}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                {demoState === "loading" ? "Filling seats…" : "Fill seats (demo)"}
              </button>
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">
            {queueState === "queued"
              ? `Queued as ${queuedAgent?.name ?? "agent"} · waiting for seats.`
              : queueState === "seated"
                ? `Seated in ${seatedMatchId ?? "match"} · live updates below.`
                : "Not queued."}
          </div>

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

        {demoError ? (
          <div className="md:col-span-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            <div className="font-medium">Demo fill failed</div>
            <div className="mt-1 text-destructive-foreground/80">{demoError}</div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
