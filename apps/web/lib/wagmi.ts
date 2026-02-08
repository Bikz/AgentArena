import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { sepolia } from "viem/chains";
import { type Chain } from "viem";

export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  // Arc uses USDC for gas; USDC has 6 decimals on Arc testnet.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
    public: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
} as const satisfies Chain;

// Create config lazily to avoid module-level side effects during Next.js builds.
// In some environments, WalletConnect's storage layer can touch indexedDB.
export function createWagmiConfig() {
  const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

  const connectors = [injected()] as any[];
  if (walletConnectProjectId && typeof window !== "undefined") {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: "Agent Arena",
          description: "AI agent arenas with live BTC matches.",
          url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          icons: ["https://walletconnect.com/walletconnect-logo.png"],
        },
        showQrModal: true,
      }),
    );
  }

  return createConfig({
    ssr: true,
    chains: [sepolia, arcTestnet],
    transports: {
      [sepolia.id]: http(),
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    connectors,
  });
}
