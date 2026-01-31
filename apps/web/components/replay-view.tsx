import Link from "next/link";

type ReplayData = {
  match: {
    id: string;
    created_at: string;
    phase: string;
    tick_interval_ms: number;
    max_ticks: number;
    start_price: string | number;
  };
  seats: Array<{
    seat_id: string;
    agent_id: string | null;
    agent_name: string;
    strategy: string;
  }>;
  ticks: Array<{
    tick: number;
    ts: string;
    btc_price: string | number;
    leaderboard: Array<{
      seatId: string;
      agentName: string;
      credits: number;
      target: number;
    }>;
  }>;
};

async function fetchReplay(matchId: string): Promise<ReplayData | null> {
  const base = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/matches/${matchId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function ReplayView({ matchId }: { matchId: string }) {
  const data = await fetchReplay(matchId);
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Replay</h1>
        <div className="text-sm text-muted-foreground">
          Replay not found (or DB not configured).
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to lobby
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Replay</div>
          <h1 className="text-2xl font-semibold tracking-tight">{matchId}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Phase: {data.match.phase} · ticks: {data.ticks.length}/
            {data.match.max_ticks}
          </div>
        </div>
        <Link href={`/match/${matchId}`} className="text-sm underline underline-offset-4">
          Live view
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-medium">Ticks</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Tick</th>
                <th className="py-2 pr-4 font-medium">BTC</th>
                <th className="py-2 pr-4 font-medium">Top agent</th>
                <th className="py-2 pr-4 font-medium">Top credits</th>
              </tr>
            </thead>
            <tbody>
              {data.ticks.map((t) => {
                const top = [...t.leaderboard].sort(
                  (a, b) => b.credits - a.credits,
                )[0];
                return (
                  <tr key={t.tick} className="border-t border-border">
                    <td className="py-2 pr-4">{t.tick}</td>
                    <td className="py-2 pr-4">
                      ${Number(t.btc_price).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4">{top?.agentName ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {top ? top.credits.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-medium">Seats</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Seat</th>
                <th className="py-2 pr-4 font-medium">Agent</th>
                <th className="py-2 pr-4 font-medium">Strategy</th>
                <th className="py-2 pr-4 font-medium">Agent ID</th>
              </tr>
            </thead>
            <tbody>
              {data.seats.map((s) => (
                <tr key={s.seat_id} className="border-t border-border">
                  <td className="py-2 pr-4">{s.seat_id}</td>
                  <td className="py-2 pr-4">{s.agent_name}</td>
                  <td className="py-2 pr-4">{s.strategy}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {s.agent_id ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
