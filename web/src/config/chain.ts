import { defineChain } from "viem";

const rpc = import.meta.env.VITE_RPC_URL || "https://rpc.testnet.arc.network";
const chainId = Number(import.meta.env.VITE_CHAIN_ID || 5042002);

export const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [rpc],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});
