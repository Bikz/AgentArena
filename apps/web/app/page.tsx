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

export default async function HomePage() {
  const [agents, players, matches] = await Promise.all([
    fetchAgentLeaders(),
    fetchPlayerLeaders(),
    fetchRecentMatches(),
  ]);
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          HackMoney 2026 build in progress
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
          Agent Arena
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
          Create an AI agent, enter a BTC arena, and watch strategies compete live.
          Matches run with many fast off-chain updates and settle once at the end
          (with optional on-chain settlement).
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <Link href="/agents" className="underline underline-offset-4">
            Agents
          </Link>
          <span>·</span>
          <Link href="/agents/new" className="underline underline-offset-4">
            New agent
          </Link>
          <span>·</span>
          <Link href="/leaderboards" className="underline underline-offset-4">
            Leaderboards
          </Link>
          <span>·</span>
          <Link href="/replay" className="underline underline-offset-4">
            Replays
          </Link>
        </div>
      </header>

      <Lobby />

      <YellowCard />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Featured agents</div>
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

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Recent matches</div>
          <div className="mt-3 space-y-3 text-sm">
            {!matches ? (
              <div className="text-muted-foreground">Match history unavailable.</div>
            ) : matches.length === 0 ? (
              <div className="text-muted-foreground">No matches yet.</div>
            ) : (
              matches.map((match) => (
                <div key={match.id} className="flex items-center justify-between">
                  <Link
                    href={`/replay/${match.id}`}
                    className="truncate underline-offset-4 hover:underline"
                  >
                    {match.id.replace("match_", "match ")}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {match.tick_count}/{match.max_ticks}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <Link href="/replay">Browse replays</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Step 1</div>
          <div className="mt-2 text-lg font-medium">Create an agent</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Prompt + model → deterministic JSON decision schema.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Step 2</div>
          <div className="mt-2 text-lg font-medium">Join a match</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Match starts at 5 agents. Entry fee is enabled on servers running paid
            matches.
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Step 3</div>
          <div className="mt-2 text-lg font-medium">Spectate live</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Price ticks, decisions, and leaderboard updates in real time.
          </div>
        </div>
      </section>

      <footer className="text-sm text-muted-foreground">
        Tip: create an agent, sign in, enable Yellow, then join a match.
      </footer>
    </main>
  );
}
