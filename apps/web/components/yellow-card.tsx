"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { useAuth } from "@/hooks/useAuth";

type Balance = { asset: string; amount: string };

function apiBase() {
  return process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
}

export function YellowCard() {
  const { address, isConnected } = useAccount();
  const auth = useAuth();
  const { signTypedDataAsync } = useSignTypedData();

  const [state, setState] = useState<"idle" | "loading" | "enabling" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const isReady = useMemo(() => {
    return Boolean(balances);
  }, [balances]);

  const refresh = useCallback(async () => {
    if (!auth.isSignedIn) return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/yellow/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setBalances(null);
        setState("idle");
        return;
      }
      const json = (await res.json()) as { ok: true; balances: Balance[] };
      setBalances(json.balances ?? []);
      setLastUpdated(Date.now());
      setState("idle");
    } catch (err) {
      setBalances(null);
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [auth.isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ytestUsd = useMemo(() => {
    const b = (balances ?? []).find((x) => x.asset === "ytest.usd");
    return b?.amount ?? null;
  }, [balances]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Yellow Network</h2>
        <div className="text-sm text-muted-foreground">
          Enable a session key for fast, off-chain match settlement (Nitrolite).
        </div>
      </div>

      {!isConnected ? (
        <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          Connect your wallet to enable Yellow.
        </div>
      ) : !auth.isSignedIn ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
          <div className="text-sm text-muted-foreground">
            Sign in to enable Yellow session keys.
          </div>
          <button
            type="button"
            disabled={auth.state === "signing" || auth.state === "loading"}
            onClick={() => auth.signIn()}
            className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {auth.state === "signing" ? "Signing…" : "Sign in"}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Wallet</div>
              <div className="mt-1 break-all text-sm">{address ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">ytest.usd</div>
              <div className="mt-1 text-sm">{ytestUsd ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={state === "enabling" || !isConnected || !auth.isSignedIn}
              onClick={async () => {
                if (!auth.isSignedIn || !isConnected) return;
                setState("enabling");
                setError(null);
                try {
                  const startRes = await fetch(`${apiBase()}/yellow/auth/start`, {
                    method: "POST",
                    credentials: "include",
                  });
                  if (!startRes.ok) {
                    const text = await startRes.text();
                    throw new Error(text || "Failed to start Yellow auth.");
                  }

                  const startJson = (await startRes.json()) as {
                    typedData: {
                      domain: { name: string };
                      types: any;
                      primaryType: "Policy";
                      message: {
                        scope: string;
                        session_key: `0x${string}`;
                        expires_at: string;
                        allowances: Array<{ asset: string; amount: string }>;
                        wallet: `0x${string}`;
                        challenge: string;
                      };
                    };
                  };

                  const typed = startJson.typedData;
                  const signature = await signTypedDataAsync({
                    domain: typed.domain,
                    types: typed.types,
                    primaryType: typed.primaryType,
                    message: {
                      ...typed.message,
                      expires_at: BigInt(typed.message.expires_at),
                    } as any,
                  });

                  const verifyRes = await fetch(`${apiBase()}/yellow/auth/verify`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ signature }),
                  });
                  if (!verifyRes.ok) {
                    const text = await verifyRes.text();
                    throw new Error(text || "Failed to verify Yellow auth.");
                  }

                  await refresh();
                  setState("idle");
                } catch (err) {
                  setBalances(null);
                  setState("error");
                  setError(err instanceof Error ? err.message : "Unknown error");
                }
              }}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isReady ? "Re-enable session" : state === "enabling" ? "Enabling…" : "Enable Yellow"}
            </button>

            <button
              type="button"
              disabled={!auth.isSignedIn || state === "enabling"}
              onClick={() => void refresh()}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              Refresh balance
            </button>

            <button
              type="button"
              disabled={!auth.isSignedIn || state === "enabling"}
              onClick={async () => {
                setState("loading");
                setError(null);
                try {
                  const res = await fetch(`${apiBase()}/yellow/faucet`, {
                    method: "POST",
                    credentials: "include",
                  });
                  if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Faucet request failed.");
                  }
                  await new Promise((r) => setTimeout(r, 1200));
                  await refresh();
                  setState("idle");
                } catch (err) {
                  setState("error");
                  setError(err instanceof Error ? err.message : "Unknown error");
                }
              }}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              Request faucet tokens
            </button>

            {lastUpdated ? (
              <div className="text-sm text-muted-foreground">
                Updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
