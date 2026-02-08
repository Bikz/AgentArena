"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiBaseHttp } from "@/lib/api";
import { ShareLinkButton } from "@/components/share-link-button";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";
import { fetchJson, HttpError } from "@/lib/http";

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

async function fetchPlayerPerf(address: string): Promise<PerfResponse | null> {
  try {
    const { data } = await fetchJson<PerfResponse>(
      `${apiBaseHttp()}/players/${address}/perf`,
      { cache: "no-store" },
      { timeoutMs: 15_000 },
    );
    return data;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

export function PlayerProfile({ address }: { address: string }) {
  const { pushToast } = useToasts();
  const [perf, setPerf] = useState<PerfResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState("loading");
      try {
        const data = await fetchPlayerPerf(address);
        if (cancelled) return;
        if (!data) {
          setPerf(null);
          setState("error");
          return;
        }
        setPerf(data);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        const n = normalizeError(err, { feature: "player_perf" });
        setPerf(null);
        setState("error");
        pushToast({
          title: n.title,
          message: n.message,
          details: n.details,
          variant: n.variant,
          dedupeKey: `player:perf:${n.title}:${n.message}`,
          dedupeWindowMs: 30_000,
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [address, pushToast]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Player
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Player profile</h1>
          <div className="mt-1 break-all text-sm text-muted-foreground">{address}</div>
        </div>
        <div className="flex items-center gap-3">
          <ShareLinkButton path={`/players/${address}`} label="Share" />
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to arenas
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-medium">Performance</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          Recent matches across all agents for this wallet.
        </div>

        {state === "loading" ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading performance…</div>
        ) : state === "error" || !perf ? (
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
                      <th className="py-2 pr-4 font-medium">Agent</th>
                      <th className="py-2 pr-4 font-medium">Result</th>
                      <th className="py-2 pr-4 font-medium">Final credits</th>
                      <th className="py-2 pr-4 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.matches.map((m) => (
                      <tr key={`${m.matchId}-${m.seatId}`} className="border-t border-border">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/replay/${m.matchId}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {m.matchId}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          {m.agentId ? (
                            <Link
                              href={`/agents/${m.agentId}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {m.agentName}
                            </Link>
                          ) : (
                            m.agentName
                          )}
                        </td>
                        <td className="py-2 pr-4">{m.isWinner ? "Winner" : "—"}</td>
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
