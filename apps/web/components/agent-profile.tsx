"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiBaseHttp } from "@/lib/api";
import { ClaimEnsCard } from "@/components/claim-ens-card";
import { useAuth } from "@/hooks/useAuth";
import { ShareLinkButton } from "@/components/share-link-button";

type PublicAgent = {
  id: string;
  created_at: string;
  name: string;
  prompt_hash?: string | null;
  model: string;
  strategy: "hold" | "random" | "trend" | "mean_revert";
  owner_address?: string | null;
  ens_name?: string | null;
  ens_node?: string | null;
  ens_tx_hash?: string | null;
  ens_claimed_at?: string | null;
};

type PrivateAgent = PublicAgent & {
  prompt: string;
};

type PerfSummary = {
  matches: number;
  wins: number;
  winRate: number;
  avgCredits: number | null;
  bestCredits: number | null;
};

type PerfMatch = {
  matchId: string;
  createdAt: string;
  phase: string;
  tickIntervalMs: number;
  maxTicks: number;
  seatId: string;
  agentId: string | null;
  agentName: string;
  strategy: string;
  ownerAddress: string | null;
  finalTick: number | null;
  finalPrice: string | null;
  finalCredits: number | null;
  finalTarget: number | null;
  finalNote: string | null;
  isWinner: boolean;
};

type PerfResponse = {
  summary: PerfSummary;
  matches: PerfMatch[];
};

async function fetchPublicAgent(agentId: string): Promise<PublicAgent | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}/public`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { agent: PublicAgent };
  return json.agent;
}

async function fetchPrivateAgent(agentId: string): Promise<PrivateAgent | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { agent: PrivateAgent };
  return json.agent;
}

async function fetchAgentPerf(agentId: string): Promise<PerfResponse | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}/perf`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export function AgentProfile({ agentId }: { agentId: string }) {
  const auth = useAuth();

  const [publicAgent, setPublicAgent] = useState<PublicAgent | null>(null);
  const [publicState, setPublicState] = useState<"loading" | "ready" | "error">("loading");
  const [publicError, setPublicError] = useState<string | null>(null);

  const [privateAgent, setPrivateAgent] = useState<PrivateAgent | null>(null);
  const [privateState, setPrivateState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [privateError, setPrivateError] = useState<string | null>(null);

  const [perf, setPerf] = useState<PerfResponse | null>(null);
  const [perfState, setPerfState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPublicState("loading");
      setPublicError(null);
      setPublicAgent(null);
      try {
        const agent = await fetchPublicAgent(agentId);
        if (cancelled) return;
        if (!agent) {
          setPublicState("error");
          setPublicError("Agent not found (or DB not configured).");
          return;
        }
        setPublicAgent(agent);
        setPublicState("ready");
      } catch (err) {
        if (cancelled) return;
        setPublicState("error");
        setPublicError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPerfState("loading");
      try {
        const data = await fetchAgentPerf(agentId);
        if (cancelled) return;
        if (!data) {
          setPerf(null);
          setPerfState("error");
          return;
        }
        setPerf(data);
        setPerfState("ready");
      } catch {
        if (cancelled) return;
        setPerf(null);
        setPerfState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const isOwner =
    auth.isSignedIn &&
    auth.sessionAddress &&
    publicAgent?.owner_address &&
    publicAgent.owner_address.toLowerCase() === auth.sessionAddress.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPrivateAgent(null);
      setPrivateError(null);

      if (!isOwner) {
        setPrivateState("idle");
        return;
      }

      setPrivateState("loading");
      try {
        const agent = await fetchPrivateAgent(agentId);
        if (cancelled) return;
        if (!agent) {
          setPrivateState("error");
          setPrivateError("Failed to load private agent details.");
          return;
        }
        setPrivateAgent(agent);
        setPrivateState("ready");
      } catch (err) {
        if (cancelled) return;
        setPrivateState("error");
        setPrivateError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [agentId, isOwner]);

  if (publicState === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  if (publicState === "error" || !publicAgent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <div className="text-sm text-muted-foreground">
          {publicError ?? "Agent not found."}
        </div>
        <Link href="/agents" className="text-sm underline underline-offset-4">
          Back to agents
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Agent</div>
          <h1 className="text-2xl font-semibold tracking-tight">{publicAgent.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {publicAgent.strategy} · {publicAgent.model}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShareLinkButton path={`/agents/${publicAgent.id}`} label="Share" />
          <Link href="/agents" className="text-sm underline underline-offset-4">
            Back
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Agent ID</div>
            <div className="mt-1 break-all text-sm">{publicAgent.id}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="mt-1 text-sm">
              {new Date(publicAgent.created_at).toLocaleString()}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">ENS</div>
            <div className="mt-1 break-all text-sm text-muted-foreground">
              {publicAgent.ens_name ?? "—"}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">Owner</div>
            <div className="mt-1 break-all text-sm text-muted-foreground">
              {publicAgent.owner_address ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-medium">Prompt</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          The full prompt is only visible to the agent owner.
        </div>

        {!isOwner ? (
          <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            {auth.isSignedIn
              ? "You are signed in, but not as this agent’s owner."
              : "Sign in with the owning wallet to view this prompt."}
          </div>
        ) : privateState === "loading" ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading prompt…</div>
        ) : privateState === "error" ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
            {privateError ?? "Failed to load prompt."}
          </div>
        ) : privateAgent ? (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-sm text-foreground">
            {privateAgent.prompt}
          </pre>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">—</div>
        )}
      </section>

      <ClaimEnsCard agent={publicAgent} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-medium">Performance</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          Recent matches and aggregate stats for this agent.
        </div>

        {perfState === "loading" ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading performance…</div>
        ) : perfState === "error" || !perf ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Performance unavailable (DB not configured or no matches yet).
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <div className="text-xs text-muted-foreground">Matches</div>
                <div className="mt-1 text-lg font-medium">{perf.summary.matches}</div>
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <div className="text-xs text-muted-foreground">Win rate</div>
                <div className="mt-1 text-lg font-medium">
                  {(perf.summary.winRate * 100).toFixed(0)}%
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <div className="text-xs text-muted-foreground">Best credits</div>
                <div className="mt-1 text-lg font-medium">
                  {perf.summary.bestCredits !== null
                    ? perf.summary.bestCredits.toFixed(2)
                    : "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {perf.matches.length === 0 ? (
                <div className="text-sm text-muted-foreground">No matches yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Match</th>
                      <th className="py-2 pr-4 font-medium">Result</th>
                      <th className="py-2 pr-4 font-medium">Final credits</th>
                      <th className="py-2 pr-4 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.matches.map((m) => (
                      <tr key={m.matchId} className="border-t border-border">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/replay/${m.matchId}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {m.matchId}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          {m.isWinner ? "Winner" : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {m.finalCredits !== null ? m.finalCredits.toFixed(2) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
