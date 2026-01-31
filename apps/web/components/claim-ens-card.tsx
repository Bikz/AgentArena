"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { concatHex, keccak256, stringToHex } from "viem";
import { agentArenaSubnameRegistrarAbi, getParentNamehash, getRegistrarAddress } from "@/lib/ens-registrar";
import { useAuth } from "@/hooks/useAuth";

function sanitizeLabel(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ClaimEnsCard(props: {
  agent: {
    id: string;
    name: string;
    model: string;
    strategy: string;
    prompt: string;
    owner_address?: string | null;
    ens_name?: string | null;
    ens_node?: string | null;
    ens_tx_hash?: string | null;
  };
}) {
  const { address, isConnected, chainId } = useAccount();
  const auth = useAuth();
  const registrar = getRegistrarAddress();
  const parentNamehash = getParentNamehash();

  const [label, setLabel] = useState(() => sanitizeLabel(props.agent.name));
  const [state, setState] = useState<"idle" | "building" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canClaim = useMemo(() => {
    return (
      isConnected &&
      auth.isSignedIn &&
      address &&
      props.agent.owner_address &&
      props.agent.owner_address.toLowerCase() === address.toLowerCase() &&
      registrar &&
      parentNamehash &&
      label.length > 0
    );
  }, [
    address,
    auth.isSignedIn,
    isConnected,
    label.length,
    parentNamehash,
    props.agent.owner_address,
    registrar,
  ]);

  const { data: txHash, writeContractAsync, isPending: isWriting } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const parentDisplay = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "agentarena.eth";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-medium">ENS identity</h2>
      <div className="mt-1 text-sm text-muted-foreground">
        Claim a subname and store verifiable agent config in ENS text records.
      </div>

      {props.agent.ens_name ? (
        <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <div className="text-muted-foreground">Claimed</div>
          <div className="mt-1 break-all font-medium">{props.agent.ens_name}</div>
          {props.agent.ens_tx_hash ? (
            <div className="mt-1 break-all text-muted-foreground">
              Tx: {props.agent.ens_tx_hash}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm text-muted-foreground" htmlFor="label">
            Label
          </label>
          <input
            id="label"
            value={label}
            onChange={(e) => setLabel(sanitizeLabel(e.target.value))}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="my-agent"
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Full name: <span className="font-medium">{label || "—"}</span>.
            {parentDisplay}
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="text-sm text-muted-foreground">Chain</div>
          <div className="mt-1 text-sm">
            {chainId ? `chainId ${chainId}` : "—"}
          </div>
        </div>
      </div>

      {(!registrar || !parentNamehash) && (
        <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          Missing ENS env vars. Set `NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS` and
          `NEXT_PUBLIC_ENS_PARENT_NAMEHASH`.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!canClaim || isWriting || receipt.isLoading || props.agent.ens_name != null}
          onClick={async () => {
            if (!canClaim || !address || !registrar || !parentNamehash) return;
            setState("building");
            setError(null);
            try {
              const promptHash = await sha256Hex(props.agent.prompt);

              const keys = [
                "arena.agentId",
                "arena.promptHash",
                "arena.model",
                "arena.strategy",
                "arena.version",
              ];
              const values = [
                props.agent.id,
                `0x${promptHash}`,
                props.agent.model,
                props.agent.strategy,
                "v0",
              ];

              const tx = await writeContractAsync({
                address: registrar,
                abi: agentArenaSubnameRegistrarAbi,
                functionName: "register",
                args: [label, address, keys, values],
              });

              // Compute expected ENS node for persistence.
              const labelhash = keccak256(stringToHex(label));
              const node = keccak256(concatHex([parentNamehash, labelhash]));
              const ensName = `${label}.${parentDisplay}`;

              setState("saving");
              const base = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
              const res = await fetch(`${base}/agents/${props.agent.id}/ens`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  ensName,
                  ensNode: node,
                  txHash: tx,
                }),
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Failed to persist ENS claim.");
              }

              // Hard refresh to show claimed fields.
              window.location.reload();
            } catch (err) {
              setState("error");
              setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
              setState("idle");
            }
          }}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {props.agent.ens_name
            ? "Already claimed"
            : state === "saving"
              ? "Saving…"
              : state === "building"
                ? "Preparing…"
                : isWriting
                  ? "Claiming…"
                  : "Claim subname"}
        </button>
        <div className="text-sm text-muted-foreground">
          {receipt.isLoading
            ? "Waiting for confirmation…"
            : receipt.isSuccess
              ? "Confirmed"
              : " "}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          <div className="font-medium">Couldn’t claim</div>
          <div className="mt-1 text-destructive-foreground/80">{error}</div>
        </div>
      ) : null}
    </section>
  );
}

