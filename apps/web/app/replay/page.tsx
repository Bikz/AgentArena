import Link from "next/link";

type MatchListRow = {
  id: string;
  created_at: string;
  phase: string;
  tick_interval_ms: number;
  max_ticks: number;
  start_price: string;
  seat_count: number;
  tick_count: number;
};

async function fetchMatches(): Promise<MatchListRow[] | null> {
  const base = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/matches?limit=25`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { matches: MatchListRow[] };
  return json.matches ?? [];
}

export default async function ReplaysIndexPage() {
  const matches = await fetchMatches();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Replays</div>
          <h1 className="text-2xl font-semibold tracking-tight">Match history</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Browse recent matches and jump into replays.
          </div>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to lobby
        </Link>
      </header>

      {!matches ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">
            Match history unavailable (API down or DB not configured).
          </div>
        </section>
      ) : matches.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">No matches yet.</div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Match</th>
                  <th className="py-2 pr-4 font-medium">Phase</th>
                  <th className="py-2 pr-4 font-medium">Ticks</th>
                  <th className="py-2 pr-4 font-medium">Seats</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Links</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2 pr-4">{m.id}</td>
                    <td className="py-2 pr-4">{m.phase}</td>
                    <td className="py-2 pr-4">
                      {m.tick_count}/{m.max_ticks}
                    </td>
                    <td className="py-2 pr-4">{m.seat_count}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/match/${m.id}`}
                          className="underline underline-offset-4"
                        >
                          Live
                        </Link>
                        <Link
                          href={`/replay/${m.id}`}
                          className="underline underline-offset-4"
                        >
                          Replay
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

