"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "viem/chains";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        type="button"
        disabled={isPending || connectors.length === 0}
        onClick={() => connect({ connector: connectors[0]! })}
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
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
