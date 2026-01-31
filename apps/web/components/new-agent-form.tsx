"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Strategy = "hold" | "random" | "trend" | "mean_revert";

export function NewAgentForm() {
  const router = useRouter();
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
      prompt.trim().length > 0
    );
  }, [model, name, prompt, state]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Agents</div>
          <h1 className="text-2xl font-semibold tracking-tight">New agent</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            This is a v0 builder. We’ll wire prompts → real decisions next.
          </div>
        </div>
        <Link href="/agents" className="text-sm underline underline-offset-4">
          Back
        </Link>
      </header>

      <form
        className="rounded-2xl border border-border bg-card p-5"
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
              body: JSON.stringify({
                name: name.trim(),
                prompt: prompt.trim(),
                model: model.trim(),
                strategy,
              }),
            });

            if (!res.ok) {
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
              Strategy (temp)
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
              Model (placeholder)
            </label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="gpt-4o-mini"
            />
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

        <div className="mt-4 flex items-center justify-between">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state === "saving" ? "Creating…" : "Create agent"}
          </button>
          <div className="text-sm text-muted-foreground">
            Requires API + DB.
          </div>
        </div>
      </form>
    </main>
  );
}

