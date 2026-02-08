"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";
import { fetchJson } from "@/lib/http";

type AuthState = "idle" | "loading" | "signing" | "error";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
}

export function useAuth() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { pushToast } = useToasts();

  const [state, setState] = useState<AuthState>("loading");
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const { data } = await fetchJson<{ address: string | null }>(
        `${apiBase()}/auth/me`,
        { method: "GET", credentials: "include", cache: "no-store" },
        { timeoutMs: 10_000 },
      );
      setSessionAddress(data.address ?? null);
      setState("idle");
    } catch (err) {
      setState("error");
      const n = normalizeError(err, { feature: "auth_me" });
      setError(n.message);
      pushToast({
        title: n.title,
        message: n.message,
        details: n.details,
        variant: n.variant,
        dedupeKey: `auth:me:${n.title}:${n.message}`,
        dedupeWindowMs: 30_000,
      });
    }
  }, [pushToast]);

  useEffect(() => {
    void refresh();
  }, [refresh, isConnected]);

  const isSignedIn = useMemo(() => {
    return Boolean(sessionAddress && address && sessionAddress === address);
  }, [address, sessionAddress]);

  const signIn = useCallback(async () => {
    if (!isConnected || !address) throw new Error("wallet_not_connected");

    setState("signing");
    setError(null);
    try {
      const { data: nonceData } = await fetchJson<{ nonce: string }>(
        `${apiBase()}/auth/nonce`,
        { method: "POST", credentials: "include" },
        { timeoutMs: 10_000 },
      );
      const nonce = nonceData.nonce;

      const domain = window.location.host;
      const uri = window.location.origin;
      const issuedAt = new Date().toISOString();

      const message =
        `${domain} wants you to sign in with your Ethereum account:\n` +
        `${address}\n\n` +
        `Sign in to Agent Arena.\n\n` +
        `URI: ${uri}\n` +
        `Version: 1\n` +
        `Chain ID: ${chainId}\n` +
        `Nonce: ${nonce}\n` +
        `Issued At: ${issuedAt}`;

      const signature = await signMessageAsync({ message });

      await fetchJson<{ ok: true; address: string }>(
        `${apiBase()}/auth/verify`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, signature }),
        },
        { timeoutMs: 15_000 },
      );

      await refresh();
      setState("idle");
    } catch (err) {
      setState("error");
      const n = normalizeError(err, { feature: "auth_signin" });
      setError(n.message);
      pushToast({
        title: n.title,
        message: n.message,
        details: n.details,
        variant: n.variant,
        dedupeKey: `auth:signin:${n.title}:${n.message}`,
        dedupeWindowMs: 15_000,
      });
    }
  }, [address, chainId, isConnected, refresh, signMessageAsync, pushToast]);

  const signOut = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      await fetchJson<{ ok: true }>(`${apiBase()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      await refresh();
    }
  }, [refresh]);

  return {
    state,
    error,
    isSignedIn,
    sessionAddress,
    refresh,
    signIn,
    signOut,
  };
}
