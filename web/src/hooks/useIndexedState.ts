import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addresses } from "@/config/contracts";
import { fetchIndexedState } from "@/libs/arcscan";

const INDEXED_QUERY_KEY = ["indexed-state", "arcscan", addresses.settleNet] as const;

export function useIndexedState() {
  return useQuery({
    queryKey: INDEXED_QUERY_KEY,
    queryFn: fetchIndexedState,
    staleTime: 3 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useInvalidateIndexed() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: INDEXED_QUERY_KEY }),
      qc.invalidateQueries({ queryKey: ["owned-agents"] }),
    ]);
}

export function useResetIndexed() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.resetQueries({ queryKey: INDEXED_QUERY_KEY }),
      qc.resetQueries({ queryKey: ["owned-agents"] }),
    ]);
}
