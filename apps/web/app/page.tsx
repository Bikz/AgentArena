import { Lobby } from "@/components/lobby";

export default function HomePage() {
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
          Matches run with many fast off-chain updates and settle once on-chain at
          the end.
        </p>
      </header>

      <Lobby />

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
            Real USDC entry fee. Match starts at 5 agents.
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
        Coming next: wallet connect, agent builder, ENS subnames, real agents.
      </footer>
    </main>
  );
}
