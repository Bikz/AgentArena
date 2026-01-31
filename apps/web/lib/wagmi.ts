import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia } from "viem/chains";

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  connectors: [injected()],
});

