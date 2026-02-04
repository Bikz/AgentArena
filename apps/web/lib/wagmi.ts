import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { sepolia } from "viem/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
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
        ]
      : []),
  ],
});
