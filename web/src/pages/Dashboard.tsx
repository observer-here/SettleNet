import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { JobCard, JobListSkeleton } from "@/components/jobs/JobCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { JobStatusChart } from "@/components/dashboard/JobStatusChart";
import {
  IconBriefcase,
  IconCheckCircle,
  IconCoin,
  IconPlus,
  IconUsers,
} from "@/components/ui/Icons";
import { useJobs } from "@/hooks/useJobs";
import { useProtocolStats } from "@/hooks/useProtocolStats";
import { useWriteSettle } from "@/hooks/useContracts";
import { useIndexedState } from "@/hooks/useIndexedState";
import { JobStatus, EMPTY_STATUS_COUNTS } from "@/types/job";
import { formatUsdc } from "@/utils/format";
import { claimJobWithBond } from "@/utils/claimJob";
import { canClaimJob } from "@/utils/jobMath";

export function DashboardPage() {
  const { address } = useAccount();
  const { jobs, isLoading, refetch } = useJobs();
  const { data: indexed } = useIndexedState();
  const { data: proto, isLoading: protoLoading } = useProtocolStats();
  const statsPending = protoLoading && !proto;
  const openJobs = jobs.filter((j) => j.status === JobStatus.Open).slice(0, 3);
  const { writeContractAsync, isPending } = useWriteSettle();
  const [claiming, setClaiming] = useState<bigint | null>(null);

  const myAgentIds = useMemo(() => {
    if (!address || !indexed) return new Set<string>();
    const a = address.toLowerCase();
    return new Set(
      indexed.agents.filter((x) => x.owner?.toLowerCase() === a).map((x) => x.id.toString()),
    );
  }, [indexed, address]);

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

  const metrics: {
    label: string;
    value: string;
    Icon: ComponentType<{ size?: number; className?: string }>;
    tone: string;
  }[] = [
    {
      label: "Total Jobs",
      value: String(proto?.totalJobs ?? 0),
      Icon: IconBriefcase,
      tone: "text-[var(--color-accent)] bg-emerald-500/15",
    },
    {
      label: "USDC Escrowed",
      value: formatUsdc(proto?.escrowed ?? 0n),
      Icon: IconCoin,
      tone: "text-[var(--color-violet)] bg-violet-500/15",
    },
    {
      label: "Active Agents",
      value: String(proto?.activeAgents ?? 0),
      Icon: IconUsers,
      tone: "text-[var(--color-blue)] bg-blue-500/15",
    },
    {
      label: "Total Settlements",
      value: String(proto?.settlements ?? 0),
      Icon: IconCheckCircle,
      tone: "text-[var(--color-orange)] bg-amber-500/15",
    },
  ];

  return (
    <div>
      <TopHeader
        title="Welcome back!"
        subtitle="Here's what's happening with SettleNet"
        actions={
          <Link
            to="/jobs/new"
            className="accent-btn inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs md:px-3 md:py-2 md:text-[13px]"
          >
            Create Job
            <IconPlus size={13} />
          </Link>
        }
      />

      <ServiceGate>
      <div
        className="mb-2 grid grid-cols-2 gap-1.5 md:mb-3 md:gap-2 xl:grid-cols-4"
        aria-busy={statsPending || undefined}
      >
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="panel flex items-center gap-2 rounded-lg px-2 py-2 md:gap-3 md:rounded-xl md:px-3 md:py-2.5"
          >
            <span className={`icon-chip h-8 w-8 shrink-0 md:h-9 md:w-9 ${m.tone}`}>
              <m.Icon size={15} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[10px] text-[var(--color-muted)] md:text-[11px]">{m.label}</div>
              {statsPending ? (
                <div
                  className="mt-1 h-4 w-10 animate-pulse rounded bg-white/[0.1] md:h-5"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              ) : (
                <div className="truncate text-sm font-bold tracking-tight tabular-nums leading-tight md:text-lg">
                  {m.value}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 grid items-stretch gap-2 md:mb-5 md:gap-4 lg:grid-cols-2">
        <RecentActivity />
        <JobStatusChart
          byStatus={proto?.byStatus ?? EMPTY_STATUS_COUNTS}
          total={proto?.totalJobs ?? 0}
          bondsLocked={proto?.bondsLocked ?? 0n}
          feesSettled={proto?.feesSettled ?? 0n}
          coverageLocked={proto?.coverageLocked ?? 0n}
          inFlight={proto?.inFlight ?? 0}
          awaitingRate={proto?.awaitingRate ?? 0}
          atRisk={(proto?.ghosts ?? 0) + (proto?.pendingSlash ?? 0)}
          loading={statsPending}
        />
      </div>

      <section className="panel rounded-xl p-3 md:rounded-2xl md:p-5">
        <div className="mb-3 flex items-center justify-between md:mb-4">
          <h2 className="text-sm font-semibold md:text-base">Open Jobs</h2>
          <Link to="/jobs" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] md:text-sm">
            View all jobs
          </Link>
        </div>
        {isLoading ? (
          <JobListSkeleton count={3} className="grid gap-2 md:gap-4 md:grid-cols-2 xl:grid-cols-3" />
        ) : openJobs.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--color-muted)] md:py-6 md:text-sm">
            No open jobs. After an agent is approved, providers can claim.
          </p>
        ) : (
          <div className="grid gap-2 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {openJobs.map((job) => {
              const claimable = canClaimJob(job, address, myAgentIds);
              return (
                <JobCard
                  key={String(job.id)}
                  job={job}
                  showClaim={claimable}
                  actionPending={claiming === job.id || isPending}
                  onAction={claimable ? () => claim(job.id, job.budget) : undefined}
                />
              );
            })}
          </div>
        )}
      </section>
      </ServiceGate>
    </div>
  );
}
