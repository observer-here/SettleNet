import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEventLogs, stringToHex } from "viem";
import { identityRegistryAbi } from "@/abi";
import { addresses, contracts } from "@/config/contracts";
import { fetchOwnedAgentIds } from "@/libs/arcscan";

type AgentMeta = {
  name: string;
  description: string;
};

const ARCSCAN_API =
  import.meta.env.VITE_ARCSCAN_API || "https://testnet.arcscan.app/api/v2";

export function useOwnedAgentIds() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["owned-agents", "arcscan", addresses.identity, address],
    enabled: !!address,
    staleTime: 3 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: () => fetchOwnedAgentIds(address!),
  });
}

async function fetchAgentMeta(agentId: bigint): Promise<AgentMeta> {
  try {
    const res = await fetch(
      `${ARCSCAN_API}/tokens/${addresses.identity}/instances/${agentId}`,
    );
    if (!res.ok) return { name: "", description: "" };
    const j = (await res.json()) as {
      metadata?: { name?: unknown; description?: unknown };
      token?: { metadata?: { name?: unknown; description?: unknown } };
    };
    const md = j.metadata ?? j.token?.metadata;
    return {
      name: typeof md?.name === "string" ? md.name.trim() : "",
      description: typeof md?.description === "string" ? md.description.trim() : "",
    };
  } catch {
    return { name: "", description: "" };
  }
}

export function useAgentMeta(agentId?: bigint) {
  return useQuery({
    queryKey: ["agent-meta", addresses.identity, String(agentId ?? "")],
    enabled: agentId != null && agentId > 0n,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchAgentMeta(agentId!),
  });
}

function buildAgentUri(name: string, description: string) {
  const payload = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: name.trim() || "SettleNet Agent",
    description:
      description.trim() || "SettleNet evaluator agent on Arc Testnet",
  };
  return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
}

export function useMintAgent() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const client = usePublicClient();

  const mint = async (name: string, description = "") => {
    const n = name.trim() || "SettleNet Agent";
    const d = description.trim() || "SettleNet evaluator agent on Arc Testnet";
    return writeContractAsync({
      ...contracts.identity,
      functionName: "register",
      args: [
        buildAgentUri(n, d),
        [
          { metadataKey: "name", metadataValue: stringToHex(n) },
          { metadataKey: "description", metadataValue: stringToHex(d) },
        ],
      ],
    });
  };

  const resolveAgentId = async (txHash: `0x${string}`) => {
    if (!client) return null;
    const r = await client.waitForTransactionReceipt({ hash: txHash });
    const transfers = parseEventLogs({
      abi: identityRegistryAbi,
      logs: r.logs,
      eventName: "Transfer",
    });
    const last = transfers[transfers.length - 1] as
      | { args: { tokenId: bigint } }
      | undefined;
    return last?.args.tokenId ?? null;
  };

  return { mint, resolveAgentId, isPending, error };
}
