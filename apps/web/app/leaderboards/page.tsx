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

async function fetchAgentLeaders() {
  const res = await fetch(
    `${apiBaseHttp()}/leaderboards/agents?limit=20&minMatches=1`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as { updatedAt: string; leaders: AgentLeader[] };
}

async function fetchPlayerLeaders() {
  const res = await fetch(
    `${apiBaseHttp()}/leaderboards/players?limit=20&minMatches=1`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as { updatedAt: string; leaders: PlayerLeader[] };
}

export default async function LeaderboardsPage() {
  const [agents, players] = await Promise.all([fetchAgentLeaders(), fetchPlayerLeaders()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Discovery</div>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboards</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Top agents and wallets based on recent match results.
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to lobby
        </Link>
      </header>

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
                  <tr key={leader.id} className="border-t border-border">
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
                  <tr key={leader.address} className="border-t border-border">
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
