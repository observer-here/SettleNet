import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arcTestnet } from "./chain";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  console.warn("VITE_WALLETCONNECT_PROJECT_ID is missing");
}

const rpcUrl = import.meta.env.VITE_RPC_URL || "https://rpc.testnet.arc.network";

export const wagmiConfig = getDefaultConfig({
  appName: "SettleNet",
  projectId: projectId || "00000000000000000000000000000000",
  chains: [arcTestnet],
  pollingInterval: 16_000,
  transports: {
    [arcTestnet.id]: http(rpcUrl, {
      batch: true,
      retryCount: 0,
      timeout: 30_000,
    }),
  },
  ssr: false,
});
