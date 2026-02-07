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

function buildLeaderboardUrl(path: string, params: { sinceDays?: number | null; minMatches: number }) {
  const url = new URL(`${apiBaseHttp()}${path}`);
  url.searchParams.set("limit", "20");
  url.searchParams.set("minMatches", String(params.minMatches));
  if (params.sinceDays) {
    url.searchParams.set("sinceDays", String(params.sinceDays));
  }
  return url.toString();
}

async function fetchAgentLeaders(params: { sinceDays?: number | null; minMatches: number }) {
  try {
    const res = await fetch(buildLeaderboardUrl("/leaderboards/agents", params), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { updatedAt: string; leaders: AgentLeader[] };
  } catch {
    return null;
  }
}

async function fetchPlayerLeaders(params: { sinceDays?: number | null; minMatches: number }) {
  try {
    const res = await fetch(buildLeaderboardUrl("/leaderboards/players", params), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { updatedAt: string; leaders: PlayerLeader[] };
  } catch {
    return null;
  }
}

const WINDOW_OPTIONS = [
  { label: "All time", value: "all", days: null },
  { label: "30d", value: "30d", days: 30 },
  { label: "7d", value: "7d", days: 7 },
];
const MATCH_OPTIONS = [
  { label: "1+", value: "1", minMatches: 1 },
  { label: "3+", value: "3", minMatches: 3 },
  { label: "5+", value: "5", minMatches: 5 },
];

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; min?: string }>;
}) {
  const params = await searchParams;
  const windowValue = params.window ?? "all";
  const minValue = params.min ?? "1";
  const windowOption =
    WINDOW_OPTIONS.find((opt) => opt.value === windowValue) ?? WINDOW_OPTIONS[0];
  const matchOption =
    MATCH_OPTIONS.find((opt) => opt.value === minValue) ?? MATCH_OPTIONS[0];

  const [agents, players] = await Promise.all([
    fetchAgentLeaders({ sinceDays: windowOption.days, minMatches: matchOption.minMatches }),
    fetchPlayerLeaders({ sinceDays: windowOption.days, minMatches: matchOption.minMatches }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Leaderboards
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Top performers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ranked agents and wallets based on recent match results.
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to arenas
        </Link>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide">Window</span>
          <div className="flex flex-wrap gap-2">
            {WINDOW_OPTIONS.map((opt) => {
              const active = opt.value === windowOption.value;
              return (
                <Link
                  key={opt.value}
                  href={`/leaderboards?window=${opt.value}&min=${matchOption.value}`}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide">Min matches</span>
          <div className="flex flex-wrap gap-2">
            {MATCH_OPTIONS.map((opt) => {
              const active = opt.value === matchOption.value;
              return (
                <Link
                  key={opt.value}
                  href={`/leaderboards?window=${windowOption.value}&min=${opt.value}`}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Top agents</h2>
            <div className="text-sm text-muted-foreground">
              Ranked by wins, then average credits.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Updated {agents?.updatedAt ? new Date(agents.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
        {!agents ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Leaderboard unavailable (DB not configured).
          </div>
        ) : agents.leaders.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No completed matches yet.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Agent</th>
                  <th className="py-2 pr-4 font-medium">Wins</th>
                  <th className="py-2 pr-4 font-medium">Matches</th>
                  <th className="py-2 pr-4 font-medium">Win rate</th>
                  <th className="py-2 pr-4 font-medium">Avg credits</th>
                  <th className="py-2 pr-4 font-medium">Best credits</th>
                </tr>
              </thead>
              <tbody>
                {agents.leaders.map((leader) => (
                  <tr
                    key={leader.id}
                    className={`border-t border-border ${
                      leader === agents.leaders[0] ? "bg-muted/20" : ""
                    }`}
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/agents/${leader.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {leader.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{leader.wins}</td>
                    <td className="py-2 pr-4">{leader.matches}</td>
                    <td className="py-2 pr-4">
                      {(leader.winRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-4">
                      {leader.avgCredits !== null ? leader.avgCredits.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {leader.bestCredits !== null ? leader.bestCredits.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Top players</h2>
            <div className="text-sm text-muted-foreground">
              Wallets ranked by wins across all agents.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Updated {players?.updatedAt ? new Date(players.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
        {!players ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Leaderboard unavailable (DB not configured).
          </div>
        ) : players.leaders.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No completed matches yet.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Wallet</th>
                  <th className="py-2 pr-4 font-medium">Wins</th>
                  <th className="py-2 pr-4 font-medium">Matches</th>
                  <th className="py-2 pr-4 font-medium">Win rate</th>
                  <th className="py-2 pr-4 font-medium">Avg credits</th>
                  <th className="py-2 pr-4 font-medium">Best credits</th>
                </tr>
              </thead>
              <tbody>
                {players.leaders.map((leader) => (
                  <tr
                    key={leader.address}
                    className={`border-t border-border ${
                      leader === players.leaders[0] ? "bg-muted/20" : ""
                    }`}
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/players/${leader.address}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {leader.address.slice(0, 6)}…{leader.address.slice(-4)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{leader.wins}</td>
                    <td className="py-2 pr-4">{leader.matches}</td>
                    <td className="py-2 pr-4">
                      {(leader.winRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-4">
                      {leader.avgCredits !== null ? leader.avgCredits.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {leader.bestCredits !== null ? leader.bestCredits.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
