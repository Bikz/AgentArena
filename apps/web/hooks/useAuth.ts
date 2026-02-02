"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";

type AuthState = "idle" | "loading" | "signing" | "error";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
}

export function useAuth() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();

  const [state, setState] = useState<AuthState>("loading");
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { address: string | null };
      setSessionAddress(json.address ?? null);
      setState("idle");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

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
      const nonceRes = await fetch(`${apiBase()}/auth/nonce`, {
        method: "POST",
        credentials: "include",
      });
      if (!nonceRes.ok) throw new Error("nonce_failed");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

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

      const verifyRes = await fetch(`${apiBase()}/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) throw new Error("verify_failed");

      await refresh();
      setState("idle");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [address, chainId, isConnected, refresh, signMessageAsync]);

  const signOut = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      await fetch(`${apiBase()}/auth/logout`, {
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
