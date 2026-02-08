"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "viem/chains";
import { useEffect, useRef } from "react";
import { useToasts } from "@/components/toast-provider";
import { normalizeError } from "@/lib/errors";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function hasInjectedProvider() {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).ethereum);
}

export function ConnectWalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { pushToast } = useToasts();
  const lastErrorRef = useRef<string | null>(null);

  // wagmi's injected connector can exist even when no provider is installed.
  // Prefer WalletConnect in that case, otherwise "connect" looks like a no-op.
  const available = connectors.filter((connector) => {
    if (connector.id === "injected") return hasInjectedProvider();
    return "ready" in connector ? connector.ready : true;
  });
  const injected = hasInjectedProvider()
    ? available.find((connector) => connector.id === "injected")
    : undefined;
  const walletConnect = available.find((connector) => connector.id === "walletConnect");
  const primary = injected ?? walletConnect ?? available[0];

  useEffect(() => {
    const msg = error?.message ?? null;
    if (!msg) return;
    if (lastErrorRef.current === msg) return;
    lastErrorRef.current = msg;
    const n = normalizeError(error, { feature: "wallet_connect" });
    pushToast({
      title: n.title,
      message: n.message,
      details: n.details,
      variant: n.variant,
      dedupeKey: `wallet-connect:${msg}`,
      dedupeWindowMs: 30_000,
    });
  }, [error, pushToast]);

  if (!isConnected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending || !primary}
          onClick={() => primary && connect({ connector: primary })}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Connecting…" : primary?.name ?? "Connect wallet"}
        </button>
        {walletConnect && primary?.id !== walletConnect.id ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => connect({ connector: walletConnect })}
            className="rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            WalletConnect
          </button>
        ) : null}
        {!primary ? (
          <span className="text-xs text-muted-foreground">No wallet available</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        {address ? shortAddress(address) : "Connected"}
      </div>
      {chainId !== sepolia.id ? (
        <button
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: sepolia.id })}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
        >
          {isSwitching ? "Switching…" : "Switch to Sepolia"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted/40"
      >
        Disconnect
      </button>
    </div>
  );
}
