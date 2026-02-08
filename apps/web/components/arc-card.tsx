"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, type Address, createPublicClient, http } from "viem";
import { useAccount } from "wagmi";
import { normalizeError } from "@/lib/errors";
import { useToasts } from "@/components/toast-provider";
import { fetchJson } from "@/lib/http";

const ARC_CHAIN_ID = 5042002;
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

type ArcStatus = {
  enabled: boolean;
  requested?: boolean;
  contractAddress: string | null;
  tokenAddress: string | null;
  houseAddress: string | null;
  rpcUrl?: string | null;
  usdcAddress?: string | null;
  explorerBaseUrl?: string | null;
  chainId?: number | null;
  entryAmountBaseUnits?: string | null;
};

export function ArcCard() {
  const { pushToast } = useToasts();
  const { address } = useAccount();
  const [status, setStatus] = useState<ArcStatus | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const arc = useMemo(() => {
    const rpcUrl = status?.rpcUrl ?? ARC_RPC_URL;
    const usdc = (status?.usdcAddress ?? ARC_USDC) as Address;
    return {
      rpcUrl,
      usdc,
      explorer: status?.explorerBaseUrl ?? ARC_EXPLORER,
      chainId: status?.chainId ?? ARC_CHAIN_ID,
    };
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
        const { data: json } = await fetchJson<any>(
          `${base}/status`,
          { cache: "no-store" },
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setStatus((json?.arc ?? null) as ArcStatus | null);
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!address) {
        setBalance(null);
        setBalanceState("idle");
        return;
      }
      setBalanceState("loading");
      try {
        const client = createPublicClient({
          transport: http(arc.rpcUrl),
        });
        const [raw, decimals] = await Promise.all([
          client.readContract({
            address: arc.usdc,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as Address],
          }),
          client.readContract({
            address: arc.usdc,
            abi: erc20Abi,
            functionName: "decimals",
          }),
        ]);
        if (cancelled) return;
        setBalance(formatUnits(raw, decimals));
        setBalanceState("idle");
      } catch (err) {
        if (cancelled) return;
        setBalanceState("error");
        const n = normalizeError(err, { feature: "arc_usdc_balance" });
        pushToast({
          title: n.title,
          message: "Couldn’t load Arc USDC balance.",
          details: n.details,
          variant: "warning",
          dedupeKey: `arc:balance:${n.title}:${n.message}`,
          dedupeWindowMs: 15_000,
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [address, arc.rpcUrl, arc.usdc, pushToast]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-base font-medium">Arc (Circle) settlement</h2>
      <div className="mt-1 text-sm text-muted-foreground">
        Mirror payouts in USDC on Arc Testnet for an on-chain proof of match settlement.
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
        <div>Chain: Arc Testnet (chainId {ARC_CHAIN_ID})</div>
        <div>
          RPC: <span className="font-mono">{ARC_RPC_URL}</span>
        </div>
        <div>
          USDC: <span className="font-mono">{ARC_USDC}</span>
        </div>
        <div>
          Explorer:{" "}
          <a
            href={ARC_EXPLORER}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {ARC_EXPLORER}
          </a>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <div className="text-muted-foreground">Arc status</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Enabled: {status?.enabled ? "yes" : "no"}</span>
          <span>Escrow: {status?.contractAddress ? "set" : "missing"}</span>
          <span>House: {status?.houseAddress ? "set" : "missing"}</span>
        </div>
        {status?.contractAddress ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Escrow contract:{" "}
            <span className="font-mono">
              {status.contractAddress.slice(0, 6)}…{status.contractAddress.slice(-4)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <div className="text-muted-foreground">Your Arc USDC balance</div>
        <div className="mt-1 font-medium">
          {!address ? (
            "Connect wallet to view."
          ) : balanceState === "loading" ? (
            "Loading…"
          ) : balanceState === "error" ? (
            "Unavailable"
          ) : balance != null ? (
            `${balance} USDC`
          ) : (
            "—"
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">Wallet setup (MetaMask)</div>
        <div className="mt-2 text-xs">
          Add network manually:
          <div className="mt-1 font-mono">
            Network name: Arc Testnet
            <br />
            New RPC URL: {ARC_RPC_URL}
            <br />
            Chain ID: {ARC_CHAIN_ID}
            <br />
            Currency symbol: USDC
            <br />
            Explorer URL: {ARC_EXPLORER}
          </div>
        </div>
      </div>
    </section>
  );
}
