import { useMemo } from "react";
import { useIndexedState, useInvalidateIndexed } from "@/hooks/useIndexedState";

export function useJobs() {
  const { data, isLoading, isFetched } = useIndexedState();
  const invalidate = useInvalidateIndexed();

  return {
    jobs: data?.jobs ?? [],
    isLoading: isLoading && !isFetched,
    refetch: async () => {
      await invalidate();
    },
  };
}

export function useJob(jobId?: bigint) {
  const { data, isLoading, isFetched } = useIndexedState();
  const invalidate = useInvalidateIndexed();

  const job = useMemo(() => {
    if (jobId === undefined || !data) return undefined;
    return data.jobs.find((j) => j.id === jobId);
  }, [data, jobId]);

  return {
    job,
    isLoading: isLoading && !isFetched,
    refetch: async () => {
      await invalidate();
    },
  };
}
