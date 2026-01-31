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

async function fetchAgent(agentId: string): Promise<Agent | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { agent: Agent };
  return json.agent;
}

export async function AgentProfile({ agentId }: { agentId: string }) {
  const agent = await fetchAgent(agentId);
  if (!agent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <div className="text-sm text-muted-foreground">
          Agent not found (or DB not configured).
        </div>
        <Link href="/agents" className="text-sm underline underline-offset-4">
          Back to agents
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Agent</div>
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {agent.strategy} · {agent.model}
          </div>
        </div>
        <Link href="/agents" className="text-sm underline underline-offset-4">
          Back
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Agent ID</div>
            <div className="mt-1 break-all text-sm">{agent.id}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="mt-1 text-sm">{new Date(agent.created_at).toLocaleString()}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">Prompt</div>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-sm text-foreground">
              {agent.prompt}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}

