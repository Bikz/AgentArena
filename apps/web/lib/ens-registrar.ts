import type { Abi } from "viem";

export const agentArenaSubnameRegistrarAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner_", type: "address" },
      { name: "keys", type: "string[]" },
      { name: "values", type: "string[]" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
] as const satisfies Abi;

export function getRegistrarAddress(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS;
  if (!raw || !raw.startsWith("0x")) return null;
  return raw as `0x${string}`;
}

export function getParentNamehash(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_ENS_PARENT_NAMEHASH;
  if (!raw || !raw.startsWith("0x")) return null;
  return raw as `0x${string}`;
}

