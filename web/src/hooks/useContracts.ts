import { useMemo } from "react";
import { useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { USDC_DECIMALS } from "@/config/contracts";
import { emptyAgent } from "@/libs/arcscan";
import { useIndexedState, useInvalidateIndexed } from "@/hooks/useIndexedState";

export function parseUsdcInput(value: string) {
  return parseUnits(value || "0", USDC_DECIMALS);
}

export function useWriteSettle() {
  return useWriteContract();
}

export function useAgent(agentId?: bigint) {
  const { data, isLoading } = useIndexedState();
  const invalidate = useInvalidateIndexed();
  const enabled = agentId !== undefined && agentId > 0n;

  const agent = useMemo(() => {
    if (!enabled || !data) return undefined;
    const row = data.agents.find((a) => a.id === agentId) ?? emptyAgent(agentId!);
    return { ...row, score: row.scoreTenths };
  }, [data, agentId, enabled]);

  return {
    agent,
    isLoading: isLoading && !data,
    refetch: async () => {
      await invalidate();
    },
  };
}
