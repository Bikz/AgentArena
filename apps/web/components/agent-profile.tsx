"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiBaseHttp } from "@/lib/api";
import { ClaimEnsCard } from "@/components/claim-ens-card";
import { useAuth } from "@/hooks/useAuth";

type PublicAgent = {
  id: string;
  created_at: string;
  name: string;
  prompt_hash?: string | null;
  model: string;
  strategy: "hold" | "random" | "trend" | "mean_revert";
  owner_address?: string | null;
  ens_name?: string | null;
  ens_node?: string | null;
  ens_tx_hash?: string | null;
  ens_claimed_at?: string | null;
};

type PrivateAgent = PublicAgent & {
  prompt: string;
};

async function fetchPublicAgent(agentId: string): Promise<PublicAgent | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}/public`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { agent: PublicAgent };
  return json.agent;
}

async function fetchPrivateAgent(agentId: string): Promise<PrivateAgent | null> {
  const res = await fetch(`${apiBaseHttp()}/agents/${agentId}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { agent: PrivateAgent };
  return json.agent;
}

export function AgentProfile({ agentId }: { agentId: string }) {
  const auth = useAuth();

  const [publicAgent, setPublicAgent] = useState<PublicAgent | null>(null);
  const [publicState, setPublicState] = useState<"loading" | "ready" | "error">("loading");
  const [publicError, setPublicError] = useState<string | null>(null);

  const [privateAgent, setPrivateAgent] = useState<PrivateAgent | null>(null);
  const [privateState, setPrivateState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [privateError, setPrivateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPublicState("loading");
      setPublicError(null);
      setPublicAgent(null);
      try {
        const agent = await fetchPublicAgent(agentId);
        if (cancelled) return;
        if (!agent) {
          setPublicState("error");
          setPublicError("Agent not found (or DB not configured).");
          return;
        }
        setPublicAgent(agent);
        setPublicState("ready");
      } catch (err) {
        if (cancelled) return;
        setPublicState("error");
        setPublicError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const isOwner =
    auth.isSignedIn &&
    auth.sessionAddress &&
    publicAgent?.owner_address &&
    publicAgent.owner_address.toLowerCase() === auth.sessionAddress.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPrivateAgent(null);
      setPrivateError(null);

      if (!isOwner) {
        setPrivateState("idle");
        return;
      }

      setPrivateState("loading");
      try {
        const agent = await fetchPrivateAgent(agentId);
        if (cancelled) return;
        if (!agent) {
          setPrivateState("error");
          setPrivateError("Failed to load private agent details.");
          return;
        }
        setPrivateAgent(agent);
        setPrivateState("ready");
      } catch (err) {
        if (cancelled) return;
        setPrivateState("error");
        setPrivateError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [agentId, isOwner]);

  if (publicState === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  if (publicState === "error" || !publicAgent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <div className="text-sm text-muted-foreground">
          {publicError ?? "Agent not found."}
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
          <h1 className="text-2xl font-semibold tracking-tight">{publicAgent.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {publicAgent.strategy} · {publicAgent.model}
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
            <div className="mt-1 break-all text-sm">{publicAgent.id}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="mt-1 text-sm">
              {new Date(publicAgent.created_at).toLocaleString()}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">ENS</div>
            <div className="mt-1 break-all text-sm text-muted-foreground">
              {publicAgent.ens_name ?? "—"}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground">Owner</div>
            <div className="mt-1 break-all text-sm text-muted-foreground">
              {publicAgent.owner_address ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-medium">Prompt</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          The full prompt is only visible to the agent owner.
        </div>

        {!isOwner ? (
          <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            {auth.isSignedIn
              ? "You are signed in, but not as this agent’s owner."
              : "Sign in with the owning wallet to view this prompt."}
          </div>
        ) : privateState === "loading" ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading prompt…</div>
        ) : privateState === "error" ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
            {privateError ?? "Failed to load prompt."}
          </div>
        ) : privateAgent ? (
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-sm text-foreground">
            {privateAgent.prompt}
          </pre>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">—</div>
        )}
      </section>

      {privateAgent ? <ClaimEnsCard agent={privateAgent} /> : null}
    </main>
  );
}
