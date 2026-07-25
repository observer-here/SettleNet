import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { JobCard, JobListSkeleton } from "@/components/jobs/JobCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { JOB_STATUS_VISUAL } from "@/components/ui/StatusBadge";
import { IconList } from "@/components/ui/Icons";
import { useWriteSettle } from "@/hooks/useContracts";
import { useJobs } from "@/hooks/useJobs";
import { useIndexedState } from "@/hooks/useIndexedState";
import { JobStatus, STATUS_LABEL, type Job } from "@/types/job";
import { claimJobWithBond } from "@/utils/claimJob";
import { canClaimJob, isZero } from "@/utils/jobMath";

type Role = "client" | "provider" | "agent";

const statusFilters: Array<JobStatus | "all"> = [
  "all",
  JobStatus.Posted,
  JobStatus.AgentPending,
  JobStatus.Open,
  JobStatus.Claimed,
  JobStatus.Submitted,
  JobStatus.Completed,
  JobStatus.Rejected,
  JobStatus.Expired,
  JobStatus.Cancelled,
];

export function MyJobsPage() {
  const { address, isConnected } = useAccount();
  const { jobs, isLoading, refetch } = useJobs();
  const { data: indexed } = useIndexedState();
  const { writeContractAsync, isPending } = useWriteSettle();
  const [role, setRole] = useState<Role>("client");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [claiming, setClaiming] = useState<bigint | null>(null);

  const myAgentIds = useMemo(() => {
    if (!address || !indexed) return new Set<string>();
    const a = address.toLowerCase();
    return new Set(
      indexed.agents.filter((x) => x.owner?.toLowerCase() === a).map((x) => x.id.toString()),
    );
  }, [indexed, address]);

  const scores = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of indexed?.agents ?? []) {
      m.set(a.id.toString(), Number(a.scoreTenths) / 10);
    }
    return m;
  }, [indexed?.agents]);

  const filtered = useMemo(() => {
    if (!address) return [] as Job[];
    const a = address.toLowerCase();
    let list = jobs.filter((j) => {
      if (role === "client") return j.client.toLowerCase() === a;
      if (role === "provider") return !isZero(j.provider) && j.provider.toLowerCase() === a;
      return j.agentId > 0n && myAgentIds.has(j.agentId.toString());
    });
    if (status !== "all") list = list.filter((j) => j.status === status);
    return list;
  }, [jobs, address, role, status, myAgentIds]);

  const canClaim = (job: Job) => canClaimJob(job, address, myAgentIds);

  const claim = async (jobId: bigint, budget: bigint) => {
    if (!address) return;
    setClaiming(jobId);
    try {
      await claimJobWithBond(writeContractAsync, jobId, budget);
      await refetch();
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div>
      <TopHeader title="My Jobs" subtitle="Jobs where you are client, provider, or agent owner" />

      <ServiceGate>
      {!isConnected ? (
        <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] md:rounded-xl md:p-8 md:text-sm">
          Connect your wallet to see your jobs.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-nowrap gap-1 overflow-x-auto no-scrollbar md:gap-1.5">
            {(
              [
                ["client", "As client"],
                ["provider", "As provider"],
                ["agent", "As agent owner"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRole(k)}
                className={`tab shrink-0 ${role === k ? "tab-active" : "hover:text-[var(--color-text)]"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <FilterBar
            visible={4}
            items={statusFilters.map((s) => {
              const vis = s === "all" ? null : JOB_STATUS_VISUAL[s];
              const TabIcon = vis?.Icon ?? IconList;
              const active = status === s;
              return {
                id: String(s),
                active,
                onSelect: () => setStatus(s),
                content: (
                  <>
                    <TabIcon
                      size={12}
                      className={
                        active
                          ? undefined
                          : s === "all"
                            ? "text-[var(--color-muted)]"
                            : vis?.iconColor
                      }
                    />
                    {s === "all" ? "All" : STATUS_LABEL[s]}
                  </>
                ),
              };
            })}
          />

          {isLoading ? (
            <JobListSkeleton count={4} />
          ) : filtered.length === 0 ? (
            <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] md:rounded-xl md:p-8 md:text-sm">
              No jobs for this filter.
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {filtered.map((job) => (
                <JobCard
                  key={String(job.id)}
                  job={job}
                  agentScore={
                    job.agentId > 0n ? scores.get(job.agentId.toString()) : undefined
                  }
                  showClaim={canClaim(job)}
                  actionPending={claiming === job.id || isPending}
                  onAction={
                    canClaim(job) ? () => void claim(job.id, job.budget) : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      </ServiceGate>
    </div>
  );
}
