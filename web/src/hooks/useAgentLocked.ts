import { useMemo } from "react";
import { JobStatus } from "@/types/job";
import { RATING_WINDOW_SEC, STAKE_COVERAGE_BP, type IndexedJob } from "@/libs/arcscan";
import { useIndexedState } from "@/hooks/useIndexedState";

export type AgentJobLock = {
  jobId: bigint;
  amount: bigint;
  unlockAt?: number;
};

function isCoverageLive(j: IndexedJob, agentId: bigint, now: number) {
  if (j.applicants.some((a) => a === agentId)) return true;
  if (j.agentId !== agentId) return false;
  if ([JobStatus.Open, JobStatus.Claimed, JobStatus.Submitted].includes(j.status)) return true;
  if (
    (j.status === JobStatus.Completed || j.status === JobStatus.Rejected) &&
    j.resolvedAt > 0n
  ) {
    return now < Number(j.resolvedAt) + RATING_WINDOW_SEC;
  }
  return false;
}

export function useAgentLocked(agentId: bigint | undefined, jobs?: IndexedJob[]) {
  const { data } = useIndexedState();

  return useMemo(() => {
    if (!agentId) return { locked: 0n, jobLocks: [] as AgentJobLock[] };

    const now = Math.floor(Date.now() / 1000);
    const source = jobs ?? data?.jobs ?? [];
    const locking = source.filter((j) => isCoverageLive(j, agentId, now));
    const jobLocks: AgentJobLock[] = locking.map((j) => ({
      jobId: j.id,
      amount: (j.budget * STAKE_COVERAGE_BP) / 10_000n,
      unlockAt:
        j.resolvedAt > 0n &&
        (j.status === JobStatus.Completed || j.status === JobStatus.Rejected)
          ? Number(j.resolvedAt) + RATING_WINDOW_SEC
          : undefined,
    }));
    const locked = jobLocks.reduce((s, x) => s + x.amount, 0n);

    return { locked, jobLocks };
  }, [agentId, data, jobs]);
}
