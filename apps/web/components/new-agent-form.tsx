"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type Strategy = "hold" | "random" | "trend" | "mean_revert";

export function NewAgentForm() {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState("MyAgent");
  const [model, setModel] = useState("gpt-4o-mini");
  const [strategy, setStrategy] = useState<Strategy>("trend");
  const [prompt, setPrompt] = useState(
    "You are a trading agent competing in Agent Arena. Output a target exposure between -1 and 1 each tick.",
  );
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      state !== "saving" &&
      name.trim().length > 0 &&
      model.trim().length > 0 &&
      prompt.trim().length > 0 &&
      auth.isSignedIn
    );
  }, [auth.isSignedIn, model, name, prompt, state]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Agents
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Create a new agent</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Prompts drive decisions when AI Gateway is enabled; otherwise the fallback
            strategy is used.
          </div>
        </div>
        <Link href="/agents" className="text-sm underline underline-offset-4">
          Back to agents
        </Link>
      </header>

      <form
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSubmit) return;
          setState("saving");
          setError(null);

          try {
            const base =
              process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
            const res = await fetch(`${base}/agents`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                name: name.trim(),
                prompt: prompt.trim(),
                model: model.trim(),
                strategy,
              }),
            });

            if (!res.ok) {
              if (res.status === 401) throw new Error("Sign in to create agents.");
              const text = await res.text();
              throw new Error(text || "Failed to create agent.");
            }

            router.push("/");
          } catch (err) {
            setState("error");
            setError(err instanceof Error ? err.message : "Unknown error");
          } finally {
            setState("idle");
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-muted-foreground" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground" htmlFor="strategy">
              Fallback strategy
            </label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="trend">trend</option>
              <option value="mean_revert">mean_revert</option>
              <option value="random">random</option>
              <option value="hold">hold</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground" htmlFor="model">
              Model (AI Gateway)
            </label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="gpt-4o-mini"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Used when `AI_GATEWAY_API_KEY` is set on the API.
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 min-h-40 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            <div className="font-medium">Couldn’t create agent</div>
            <div className="mt-1 text-destructive-foreground/80">{error}</div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {state === "saving" ? "Creating…" : "Create agent"}
          </button>
          <div className="text-sm text-muted-foreground">
            {auth.isSignedIn ? "Requires API + DB." : "Sign in required."}
          </div>
        </div>
      </form>
    </main>
  );
}
