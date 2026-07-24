import { useMemo } from "react";
import { JobStatus } from "@/types/job";
import { STAKE_COVERAGE_BP } from "@/libs/arcscan";
import { useIndexedState } from "@/hooks/useIndexedState";
import { bondOf, feeOf, isZero } from "@/utils/jobMath";

export function useProtocolStats() {
  const { data, isLoading, isFetched } = useIndexedState();

  const stats = useMemo(() => {
    if (!data) return undefined;
    const byStatus: Record<JobStatus, number> = {
      [JobStatus.Posted]: 0,
      [JobStatus.AgentPending]: 0,
      [JobStatus.Open]: 0,
      [JobStatus.Claimed]: 0,
      [JobStatus.Submitted]: 0,
      [JobStatus.Completed]: 0,
      [JobStatus.Rejected]: 0,
      [JobStatus.Expired]: 0,
      [JobStatus.Cancelled]: 0,
    };
    let settlements = 0;
    let budgetVol = 0n;
    let bondVol = 0n;
    let bondsLocked = 0n;
    let feesSettled = 0n;
    let coverageLocked = 0n;
    let awaitingRate = 0;
    let ghosts = 0;

    for (const j of data.jobs) {
      byStatus[j.status]++;
      budgetVol += j.budget;
      if (!isZero(j.provider) || j.bondLockedAmt > 0n) {
        bondVol += j.bondLockedAmt > 0n ? j.bondLockedAmt : bondOf(j.budget);
      }
      if (j.status === JobStatus.Completed) {
        settlements++;
        feesSettled += feeOf(j.budget);
      }
      if (j.bondLockedAmt > 0n) bondsLocked += j.bondLockedAmt;
      if (
        [JobStatus.AgentPending, JobStatus.Open, JobStatus.Claimed].includes(j.status) &&
        j.agentId > 0n
      ) {
        coverageLocked += (j.budget * STAKE_COVERAGE_BP) / 10_000n;
      }
      if (
        (j.status === JobStatus.Completed || j.status === JobStatus.Rejected) &&
        !j.rated
      ) {
        awaitingRate++;
      }
    }

    for (const a of data.agents) ghosts += a.ghostJobs;
    const pendingSlash = data.agents.filter((a) => a.pendingSlash).length;
    const inFlight = byStatus[JobStatus.Claimed] + byStatus[JobStatus.Submitted];

    return {
      totalJobs: data.jobs.length,
      budgetVol,
      bondVol,
      settlements,
      activeAgents: data.agents.filter((a) => a.active).length,
      escrowed: data.escrowed,
      tvl: data.escrowed + data.agentStaked + data.bondsHeld,
      byStatus,
      bondsLocked,
      feesSettled,
      coverageLocked,
      inFlight,
      awaitingRate,
      ghosts,
      pendingSlash,
      tvlSeries: data.tvlSeries,
    };
  }, [data]);

  return { data: stats, isLoading: isLoading && !isFetched };
}
