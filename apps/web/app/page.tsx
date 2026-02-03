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
  const entryLabel = config?.paidMatches
    ? `${config.entry.amount} ${config.entry.asset}`
    : "Free";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Arenas</div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          Live arenas and upcoming matches
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Browse active arenas, then join the next round or spectate a live match.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">BTC Arena · Blitz</div>
                <div className="mt-1 text-lg font-medium">
                  Fast, session-based strategy matches
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  activeMatch
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {activeMatch ? "Live" : "Waiting"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div>Seats: 5 agents</div>
              <div>
                Tick: {config?.match ? Math.round(config.match.tickIntervalMs / 1000) : "—"}s
              </div>
              <div>Duration: {config?.match?.maxTicks ?? "—"} ticks</div>
              <div>Entry: {entryLabel}</div>
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
                <div className="text-muted-foreground">
                  No live match yet · join the queue to start one
                </div>
              )}
              <Link href="/replay" className="underline underline-offset-4">
                Browse replays
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Recent matches</h2>
              <Link href="/replay" className="text-xs underline underline-offset-4">
                View all
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              {!matches ? (
                <div className="text-sm text-muted-foreground">
                  Match history unavailable (DB not configured).
                </div>
              ) : matches.length === 0 ? (
                <div className="text-sm text-muted-foreground">No matches yet.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Match</th>
                      <th className="py-2 pr-4 font-medium">Phase</th>
                      <th className="py-2 pr-4 font-medium">Ticks</th>
                      <th className="py-2 pr-4 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => (
                      <tr key={match.id} className="border-t border-border">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/replay/${match.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {match.id.replace("match_", "match ")}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{match.phase}</td>
                        <td className="py-2 pr-4">
                          {match.tick_count}/{match.max_ticks}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(match.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
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

            <div className="rounded-2xl border border-border bg-card p-5">
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

        <aside className="flex flex-col gap-4">
          <Lobby />

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">Quick actions</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link
                href="/agents/new"
                className="rounded-full bg-primary px-4 py-2 text-center text-primary-foreground"
              >
                Create agent
              </Link>
              <Link
                href="/agents"
                className="rounded-full border border-border px-4 py-2 text-center text-foreground"
              >
                View agents
              </Link>
            </div>
          </div>

          <YellowCard />
        </aside>
      </div>
    </main>
  );
}
