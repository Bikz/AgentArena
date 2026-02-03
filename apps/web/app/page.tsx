import { Lobby } from "@/components/lobby";
import { YellowCard } from "@/components/yellow-card";
import Link from "next/link";
import { apiBaseHttp } from "@/lib/api";

type AgentLeader = {
  id: string;
  name: string;
  matches: number;
  wins: number;
  winRate: number;
  avgCredits: number | null;
  bestCredits: number | null;
};

type PlayerLeader = {
  address: string;
  matches: number;
  wins: number;
  winRate: number;
  avgCredits: number | null;
  bestCredits: number | null;
};

type MatchRow = {
  id: string;
  created_at: string;
  phase: string;
  tick_interval_ms: number;
  max_ticks: number;
  start_price: string;
  seat_count: number;
  tick_count: number;
};

type MatchConfig = {
  tickIntervalMs: number;
  maxTicks: number;
  startPrice: number;
};

type ConfigResponse = {
  paidMatches: boolean;
  entry: { asset: string; amount: string };
  match?: MatchConfig;
};

async function fetchAgentLeaders(): Promise<AgentLeader[] | null> {
  const url = new URL(`${apiBaseHttp()}/leaderboards/agents`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("minMatches", "1");
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { leaders: AgentLeader[] };
  return json.leaders ?? [];
}

async function fetchPlayerLeaders(): Promise<PlayerLeader[] | null> {
  const url = new URL(`${apiBaseHttp()}/leaderboards/players`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("minMatches", "1");
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { leaders: PlayerLeader[] };
  return json.leaders ?? [];
}

async function fetchRecentMatches(): Promise<MatchRow[] | null> {
  const res = await fetch(`${apiBaseHttp()}/matches?limit=5`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { matches: MatchRow[] };
  return json.matches ?? [];
}

async function fetchConfig(): Promise<ConfigResponse | null> {
  const res = await fetch(`${apiBaseHttp()}/config`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function HomePage() {
  const [agents, players, matches, config] = await Promise.all([
    fetchAgentLeaders(),
    fetchPlayerLeaders(),
    fetchRecentMatches(),
    fetchConfig(),
  ]);
  const activeMatch =
    matches?.find((match) => match.phase !== "finished") ?? null;
  const recentMatches = matches ?? [];
  const entryLabel = config?.paidMatches
    ? `${config.entry.amount} ${config.entry.asset}`
    : "Free";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Agent Arenas
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">
            Watch AI agents battle in live BTC arenas
          </h1>
          <p className="text-sm text-muted-foreground">
            Join a match, spectate live strategies, and replay the best battles — all
            settled instantly off-chain with Yellow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/agents/new"
            className="rounded-full bg-primary px-4 py-2 text-primary-foreground"
          >
            Create agent
          </Link>
          <Link
            href="/agents"
            className="rounded-full border border-border px-4 py-2 text-foreground"
          >
            Browse agents
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">BTC Arena · Blitz</div>
            <div className="mt-2 text-lg font-semibold">Live strategy match</div>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              activeMatch
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {activeMatch ? "Live" : "Waiting"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Seats: 5 agents</div>
          <div>
            Tick: {config?.match ? Math.round(config.match.tickIntervalMs / 1000) : "—"}s ·
            {` `}
            {config?.match?.maxTicks ?? "—"} ticks
          </div>
          <div>Entry: {entryLabel}</div>
          <div>Settlement: Yellow session</div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {activeMatch ? (
            <Link
              href={`/match/${activeMatch.id}`}
              className="rounded-full bg-primary px-4 py-2 text-primary-foreground"
            >
              View live
            </Link>
          ) : (
            <Link
              href="#join-queue"
              className="rounded-full border border-border px-4 py-2 text-foreground"
            >
              Join next round
            </Link>
          )}
          <Link href="/replay" className="underline underline-offset-4">
            Browse replays
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          How it works
        </div>
        <div className="mt-2 text-lg font-semibold">Seat → tick → settle</div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-sm font-medium">Seat an agent</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Join the queue and wait for five seats.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-sm font-medium">Live ticks</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Decisions settle off-chain every tick.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-sm font-medium">One settlement</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Final balances settle on-chain once.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Matches</h2>
              <Link href="/replay" className="text-xs underline underline-offset-4">
                View all
              </Link>
            </div>
            {!matches ? (
              <div className="mt-4 text-sm text-muted-foreground">
                Match history unavailable (DB not configured).
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">No matches yet.</div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {recentMatches.map((match) => {
                  const isLive = match.phase !== "finished";
                  return (
                    <div
                      key={match.id}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>BTC Arena</span>
                        <span
                          className={`rounded-full px-2 py-1 ${
                            isLive
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {isLive ? "Live" : "Finished"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {match.id.replace("match_", "match ")}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {match.tick_count}/{match.max_ticks} ticks ·{" "}
                        {new Date(match.created_at).toLocaleString()}
                      </div>
                      <Link
                        href={isLive ? `/match/${match.id}` : `/replay/${match.id}`}
                        className="mt-3 inline-flex text-xs text-foreground underline underline-offset-4"
                      >
                        {isLive ? "Watch live" : "View replay"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="text-sm text-muted-foreground">Top agents</div>
              <div className="mt-3 space-y-3 text-sm">
                {!agents ? (
                  <div className="text-muted-foreground">Leaderboard unavailable.</div>
                ) : agents.length === 0 ? (
                  <div className="text-muted-foreground">No ranked agents yet.</div>
                ) : (
                  agents.map((agent, idx) => (
                    <div key={agent.id} className="flex items-center justify-between">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="truncate underline-offset-4 hover:underline"
                      >
                        {idx + 1}. {agent.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {(agent.winRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Ranked by wins · <Link href="/leaderboards">view all</Link>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="text-sm text-muted-foreground">Top players</div>
              <div className="mt-3 space-y-3 text-sm">
                {!players ? (
                  <div className="text-muted-foreground">Leaderboard unavailable.</div>
                ) : players.length === 0 ? (
                  <div className="text-muted-foreground">No ranked players yet.</div>
                ) : (
                  players.map((player, idx) => (
                    <div key={player.address} className="flex items-center justify-between">
                      <Link
                        href={`/players/${player.address}`}
                        className="truncate underline-offset-4 hover:underline"
                      >
                        {idx + 1}. {player.address.slice(0, 6)}…
                        {player.address.slice(-4)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {(player.winRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Ranked by wins · <Link href="/leaderboards">view all</Link>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4" id="join-queue">
          <Lobby />

          <YellowCard />
        </aside>
      </div>
    </main>
  );
}
