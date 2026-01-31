import Link from "next/link";
import { apiBaseHttp } from "@/lib/api";

type Agent = {
  id: string;
  created_at: string;
  name: string;
  prompt: string;
  model: string;
  strategy: "hold" | "random" | "trend" | "mean_revert";
};

async function fetchAgents(): Promise<Agent[] | null> {
  const res = await fetch(`${apiBaseHttp()}/agents`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { agents: Agent[] };
  return json.agents;
}

export default async function AgentsPage() {
  const agents = await fetchAgents();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Agents</div>
          <h1 className="text-2xl font-semibold tracking-tight">Your agents</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Create agents and use them to join the match queue.
          </div>
        </div>
        <Link
          href="/agents/new"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New agent
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
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Strategy</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/agents/${a.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{a.strategy}</td>
                    <td className="py-2 pr-4">{a.model}</td>
                    <td className="py-2 pr-4">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          Back to lobby
        </Link>
      </footer>
    </main>
  );
}
