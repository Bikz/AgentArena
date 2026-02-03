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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Replays
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Match history</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Browse recent matches and jump into replays.
          </div>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to arenas
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
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => {
            const isLive = match.phase !== "finished";
            return (
              <div
                key={match.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
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
                <div className="mt-3 text-sm font-semibold">{match.id}</div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    Ticks: {match.tick_count}/{match.max_ticks}
                  </div>
                  <div>Seats: {match.seat_count}</div>
                  <div>{new Date(match.created_at).toLocaleString()}</div>
                </div>
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <Link
                    href={`/replay/${match.id}`}
                    className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted/40"
                  >
                    Replay
                  </Link>
                  {isLive ? (
                    <Link
                      href={`/match/${match.id}`}
                      className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Watch live
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
