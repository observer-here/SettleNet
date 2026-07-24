import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useIndexedState } from "@/hooks/useIndexedState";
import { emptyAgent, type IndexedAgent } from "@/libs/arcscan";

export function useAgentRows(ids: bigint[]) {
  const { address } = useAccount();
  const { data } = useIndexedState();

  const agents = useMemo(() => {
    if (!ids.length) return [] as IndexedAgent[];
    const byId = new Map((data?.agents ?? []).map((a) => [a.id.toString(), a]));
    return ids.map((id) => {
      const row = byId.get(id.toString()) ?? emptyAgent(id);
      if (!row.owner && address) return { ...row, owner: address };
      return row;
    });
  }, [data, ids, address]);

  return { agents };
}

export function useDiscoveredAgents() {
  const { data, isLoading, isFetched } = useIndexedState();
  return {
    agents: data?.agents ?? [],
    isLoading: isLoading && !isFetched,
  };
}
