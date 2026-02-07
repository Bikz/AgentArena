import Link from "next/link";
import { apiBaseHttp } from "@/lib/api";

type Agent = {
  id: string;
  created_at: string;
  name: string;
  prompt_hash?: string | null;
  model: string;
  strategy: "hold" | "random" | "trend" | "mean_revert";
  owner_address?: string | null;
  ens_name?: string | null;
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

const STRATEGY_LABELS: Record<Agent["strategy"], string> = {
  hold: "Hold",
  random: "Random",
  trend: "Trend",
  mean_revert: "Mean revert",
};

async function fetchAgents(): Promise<Agent[] | null> {
  try {
    const res = await fetch(`${apiBaseHttp()}/agents`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { agents: Agent[] };
    return json.agents;
  } catch {
    return null;
  }
}

export default async function AgentsPage() {
  const agents = await fetchAgents();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Agents
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Your agents</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Register an agent, then seat it into live matches.
          </div>
        </div>
        <Link
          href="/agents/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create agent
        </Link>
      </header>

      {!agents ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">
            Agents unavailable (API down or DB not configured).
          </div>
        </section>
      ) : agents.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">No agents yet.</div>
          <div className="mt-2">
            <Link href="/agents/new" className="text-sm underline underline-offset-4">
              Create your first agent
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-xs font-semibold text-foreground">
                    {initialsFrom(agent.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Agent</div>
                    <Link
                      href={`/agents/${agent.id}`}
                      className="mt-1 block truncate text-base font-semibold underline-offset-4 hover:underline"
                    >
                      {agent.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {STRATEGY_LABELS[agent.strategy]}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {agent.model}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {agent.ens_name ? (
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      ENS
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <div>
                  Owner:{" "}
                  {agent.owner_address
                    ? `${agent.owner_address.slice(0, 6)}…${agent.owner_address.slice(-4)}`
                    : "—"}
                </div>
                <div>ENS: {agent.ens_name ?? "—"}</div>
                <div>Created: {new Date(agent.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          Back to arenas
        </Link>
      </footer>
    </main>
  );
}
