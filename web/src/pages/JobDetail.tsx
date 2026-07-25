import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount, useReadContracts } from "wagmi";
import { WalletActivityRow } from "@/components/activity/WalletActivityRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  IconArrowRight,
  IconBolt,
  IconBriefcase,
  IconCheckCircle,
  IconChevronDown,
  IconClock,
  IconCoin,
  IconDoc,
  IconLock,
  IconRobotHead,
  IconSend,
  IconStar,
  IconUser,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/ui/Icons";
import { RobotIcon } from "@/components/agents/RobotIcon";
import { addresses, BOND_BP, CANCEL_FEE_BP, contracts, EVALUATOR_FEE_BP } from "@/config/contracts";
import { useJob } from "@/hooks/useJobs";
import { useAgent, useWriteSettle } from "@/hooks/useContracts";
import { useAgentRows } from "@/hooks/useAgents";
import { useOwnedAgentIds } from "@/hooks/useIdentity";
import { useIndexedState } from "@/hooks/useIndexedState";
import { toActivityItem } from "@/hooks/useWalletActivity";
import { RATING_WINDOW_SEC, STAKE_COVERAGE_BP, type IndexedAgent } from "@/libs/arcscan";
import { JobStatus, STATUS_LABEL } from "@/types/job";
import { formatExpiryAt, formatScore, formatUsdc, jobTitle, relativeTime, shortAddr, timeLeft } from "@/utils/format";
import { claimJobWithBond } from "@/utils/claimJob";
import { toastTx } from "@/components/ui/Toast";
import { ServiceGate, useServiceDown } from "@/components/layout/ServiceUnreachable";
import { bondOf, canClaimRefund, cancelFeeOf, feeOf, isZero, jobTimeline } from "@/utils/jobMath";
import { linkifyText } from "@/utils/linkify";

type Tab = "overview" | "application" | "submission" | "activity";

const JOB_METRIC_META = [
  { label: "Budget", tone: "text-[var(--color-accent)] bg-emerald-500/15", icon: IconCoin },
  { label: "Provider Bond", tone: "text-[var(--color-violet)] bg-violet-500/15", icon: IconBriefcase },
  { label: "Evaluator Fee", tone: "text-[var(--color-orange)] bg-amber-500/15", icon: IconStar },
  { label: "Expiry", tone: "text-[var(--color-blue)] bg-blue-500/15", icon: IconClock },
] as const;

function chainField(chainJob: unknown, key: string, index: number, fallback: string, trim = false) {
  if (chainJob && typeof chainJob === "object" && key in chainJob) {
    const v = (chainJob as Record<string, unknown>)[key];
    if (typeof v === "string" && (trim ? v.trim() : v)) return trim ? v.trim() : v;
  }
  if (Array.isArray(chainJob)) {
    const v = chainJob[index];
    if (typeof v === "string" && (trim ? v.trim() : v)) return trim ? v.trim() : v;
  }
  return fallback;
}

export function JobDetailPage() {
  const { id } = useParams();
  const jobId = id ? BigInt(id) : undefined;
  const { address } = useAccount();
  const { job, isLoading, refetch } = useJob(jobId);
  const { agent } = useAgent(job && job.agentId > 0n ? job.agentId : undefined);
  const { data: indexed } = useIndexedState();
  const { data: ownedIds = [] } = useOwnedAgentIds();
  const { agents: myAgents } = useAgentRows(ownedIds);
  const { writeContractAsync, isPending } = useWriteSettle();
  const [tab, setTab] = useState<Tab>("overview");
  const [submission, setSubmission] = useState("");
  const [score, setScore] = useState("8");
  const serviceDown = useServiceDown();

  const enabled = jobId !== undefined && jobId > 0n;
  const { data: chainReads } = useReadContracts({
    contracts: [{ ...contracts.settleNet, functionName: "jobs", args: [jobId!] }],
    query: { enabled, staleTime: 120_000 },
  });
  const chainJob = chainReads?.[0]?.result;

  const chainTitle = useMemo(
    () => chainField(chainJob, "title", 8, job?.title ?? "", true),
    [chainJob, job?.title],
  );

  const description = useMemo(
    () => chainField(chainJob, "description", 9, job?.description ?? ""),
    [chainJob, job?.description],
  );

  const jobLogs = useMemo(() => {
    if (!job || !indexed) return [];
    return indexed.settleLogs.filter(
      (e) => e.args.jobId != null && BigInt(e.args.jobId as bigint | string | number) === job.id,
    );
  }, [indexed, job]);

  const jobActivity = useMemo(
    () =>
      [...jobLogs]
        .sort((a, b) => b.at - a.at)
        .map((e) => toActivityItem(e, "settle", "job")),
    [jobLogs],
  );

  const applicants = job?.applicants ?? [];
  const myAppliedId = myAgents.find((a) => applicants.some((id) => id === a.id))?.id ?? null;

  const eligibleAgents = useMemo(() => {
    if (!job || !address) return [] as IndexedAgent[];
    if (address.toLowerCase() === job.client.toLowerCase()) return [];
    if (job.status !== JobStatus.Posted && job.status !== JobStatus.AgentPending) return [];
    if (myAppliedId != null) return [];
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now >= job.expiredAt) return [];
    const need = (job.budget * STAKE_COVERAGE_BP) / 10_000n;
    return myAgents.filter(
      (a) =>
        a.active &&
        a.maxBudget >= job.budget &&
        job.expiredAt <= now + a.maxExpiry &&
        a.available >= need,
    );
  }, [job, address, myAgents, myAppliedId]);

  const rejectedApps = useMemo(() => {
    if (!job || !indexed) return [] as { agentId: bigint; at: number; agent?: IndexedAgent }[];
    return jobLogs
      .filter((e) => e.eventName === "AgentRejected" && e.args.agentId != null)
      .map((e) => {
        const agentId = BigInt(e.args.agentId as bigint | string | number);
        return { agentId, at: e.at, agent: indexed.agents.find((a) => a.id === agentId) };
      })
      .sort((a, b) => b.at - a.at);
  }, [indexed, job, jobLogs]);

  const run = async (
    fn: () => Promise<unknown>,
    t?: { action: string; success: string; detail?: string },
  ) => {
    try {
      if (t) await toastTx(t, fn);
      else await fn();
      await refetch();
      window.setTimeout(() => void refetch(), 2500);
    } catch {}
  };

  if (!jobId) {
    return <p className="text-sm text-[var(--color-muted)]">Invalid job</p>;
  }
  if (serviceDown) return <ServiceGate>{null}</ServiceGate>;
  if (isLoading && !job) {
    return <JobDetailSkeleton />;
  }
  if (!job) {
    return <p className="text-sm text-[var(--color-muted)]">Job not found</p>;
  }

  const title = jobTitle(chainTitle, description);
  const alreadyRated = job.rated;
  const bondReq = bondOf(job.budget);
  const bondIsLocked = job.bondLockedAmt > 0n;
  const bondAmt = bondIsLocked ? job.bondLockedAmt : bondReq;
  const fee = feeOf(job.budget);
  const paidCancelFee = job.cancelFee ?? 0n;
  const refundEligible = canClaimRefund(job);
  const cancelPreviewFee = cancelFeeOf(
    job.budget,
    job.status === JobStatus.Open ? JobStatus.Open : JobStatus.Posted,
  );
  const coverageSnap =
    [JobStatus.AgentPending, JobStatus.Open, JobStatus.Claimed].includes(job.status) && job.agentId > 0n
      ? (job.budget * STAKE_COVERAGE_BP) / 10_000n
      : 0n;

  const isClient = !!address && address.toLowerCase() === job.client.toLowerCase();
  const isProvider = !!address && !isZero(job.provider) && address.toLowerCase() === job.provider.toLowerCase();
  const isAgentOwner =
    !!address && !!agent?.owner && address.toLowerCase() === agent.owner.toLowerCase();

  const tlAt: Record<string, number> = {};
  let latestApply: bigint | undefined;
  for (const e of jobLogs) {
    const { eventName: n, at } = e;
    if (n === "JobCreated") tlAt.posted = at;
    else if (n === "AgentApplied") {
      if (!tlAt.applied || at >= tlAt.applied) {
        tlAt.applied = at;
        if (e.args.agentId != null) latestApply = BigInt(e.args.agentId as bigint | string | number);
      }
    } else if (n === "AgentApproved") tlAt.approved = at;
    else if (n === "JobClaimed") tlAt.claimed = at;
    else if (n === "JobSubmitted") tlAt.submitted = at;
    else if (n === "JobCompleted" || n === "JobRejected" || n === "JobExpired" || n === "JobCancelled")
      tlAt.resolved = at;
    else if (n === "EvaluatorRated") tlAt.rated = at;
  }
  if (!tlAt.submitted && job.submittedAt > 0n) tlAt.submitted = Number(job.submittedAt);
  if (!tlAt.resolved && job.resolvedAt > 0n) tlAt.resolved = Number(job.resolvedAt);

  const timeline = jobTimeline(job.status, alreadyRated, {
    agentId: job.agentId,
    provider: job.provider,
    cancelFee: job.cancelFee,
    submittedAt: job.submittedAt,
    hadApply: latestApply != null || (job.applicants?.length ?? 0) > 0,
  }).map((s) => ({
    ...s,
    at: tlAt[s.key],
    label: s.key === "applied" && latestApply ? `Agent #${String(latestApply)} applied` : s.label,
  }));
  const scoreN = agent ? Number(agent.score) / 10 : null;
  const hasApplication = applicants.length > 0 || job.agentId > 0n;
  const escrowed = [
    JobStatus.Posted,
    JobStatus.AgentPending,
    JobStatus.Open,
    JobStatus.Claimed,
    JobStatus.Submitted,
  ].includes(job.status);
  const totalLocked = (escrowed ? job.budget : 0n) + (bondIsLocked ? job.bondLockedAmt : 0n);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "application", label: "Application", count: applicants.length + (job.agentId > 0n ? 1 : 0) || undefined },
    { id: "submission", label: "Submission", count: job.submission ? 1 : 0 },
    { id: "activity", label: "Activity", count: jobActivity.length },
  ];

  return (
    <div>
      <Link
        to="/jobs"
        className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
      >
        ← Back to Jobs
      </Link>

      <div className="mb-1.5 flex flex-wrap items-start md:mb-3 justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--color-muted)]">Job #{String(job.id)}</span>
            <StatusBadge status={job.status} />
            {(coverageSnap > 0n ||
              (job.status === JobStatus.Submitted && job.submittedAt > 0n) ||
              (!alreadyRated &&
                (job.status === JobStatus.Completed || job.status === JobStatus.Rejected) &&
                job.resolvedAt > 0n)) && (
              <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
                {coverageSnap > 0n && <span>Coverage {formatUsdc(coverageSnap)} USDC</span>}
                {job.status === JobStatus.Submitted && job.submittedAt > 0n && (
                  <span className="text-[var(--color-orange)]">
                    Resolve by {new Date((Number(job.submittedAt) + 7 * 86400) * 1000).toLocaleString()}
                  </span>
                )}
                {!alreadyRated &&
                  (job.status === JobStatus.Completed || job.status === JobStatus.Rejected) &&
                  job.resolvedAt > 0n && (
                    <span>
                      Rate by {new Date((Number(job.resolvedAt) + RATING_WINDOW_SEC) * 1000).toLocaleString()}
                    </span>
                  )}
              </div>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight md:text-2xl">
            {title}
          </h1>
        </div>
      </div>

      <div className="mb-1 grid gap-0.5 grid-cols-2 md:mb-3 md:gap-2 xl:grid-cols-4">
        <Metric
          label="Budget"
          value={`${formatUsdc(job.budget)} USDC`}
          hint={
            job.status === JobStatus.Cancelled
              ? `Client refund ${formatUsdc(job.budget - paidCancelFee)}`
              : job.status === JobStatus.Rejected
                ? "Refunded to client"
                : job.status === JobStatus.Expired
                  ? "Settled via claimRefund"
                  : job.status === JobStatus.Completed
                    ? "Paid to provider − fee"
                    : escrowed
                      ? "Locked in escrow"
                      : "Released"
          }
          tone="text-[var(--color-accent)] bg-emerald-500/15"
          icon={<IconCoin size={14} />}
        />
        <Metric
          label="Provider Bond"
          value={
            bondIsLocked
              ? `${formatUsdc(job.bondLockedAmt)} USDC`
              : `${formatUsdc(bondAmt)} (${BOND_BP / 100}%)`
          }
          hint={
            bondIsLocked
              ? "Locked by provider"
              : job.status === JobStatus.Cancelled ||
                  job.status === JobStatus.Rejected ||
                  job.status === JobStatus.Expired ||
                  job.status === JobStatus.Completed
                ? "Released / none"
                : "Required to claim"
          }
          tone="text-[var(--color-violet)] bg-violet-500/15"
          icon={<IconBriefcase size={14} />}
        />
        <Metric
          label={job.status === JobStatus.Cancelled ? "Cancel fee" : "Evaluator Fee"}
          value={
            job.status === JobStatus.Cancelled
              ? paidCancelFee > 0n
                ? `${formatUsdc(paidCancelFee)} (${CANCEL_FEE_BP / 100}%)`
                : "0 USDC"
              : `${formatUsdc(fee)} (${EVALUATOR_FEE_BP / 100}%)`
          }
          hint={
            job.status === JobStatus.Cancelled
              ? paidCancelFee > 0n
                ? "1% to evaluator (Open cancel)"
                : "No fee (Posted / pending)"
              : job.status === JobStatus.Completed
                ? "Paid to evaluator"
                : "Paid on completion"
          }
          tone="text-[var(--color-orange)] bg-amber-500/15"
          icon={<IconStar size={14} />}
        />
        <Metric
          label="Expiry"
          value={timeLeft(job.expiredAt)}
          hint={new Date(Number(job.expiredAt) * 1000).toLocaleString()}
          tone="text-[var(--color-blue)] bg-blue-500/15"
          icon={<IconClock size={14} />}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-0.5 border-b border-[var(--color-line)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded bg-white/5 px-1 text-[10px] tabular-nums">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5 md:gap-3 xl:grid-cols-[1fr_min(400px,100%)]">
        <div className="min-w-0 space-y-0.5 md:space-y-3">
          {tab === "overview" && (
            <div className="grid gap-1.5 md:gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="panel space-y-0.5 md:space-y-4 rounded-md p-1 md:rounded-xl md:p-5">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  <span className="icon-chip h-6 w-6 bg-white/5 text-[var(--color-muted)]">
                    <IconDoc size={12} />
                  </span>
                  Details
                </h2>
                <dl className="grid gap-1 md:gap-2.5 md:grid-cols-2">
                  <DetailRow
                    icon={<IconBriefcase size={13} />}
                    tone="bg-emerald-500/15 text-[var(--color-accent)]"
                    label="Job ID"
                    value={`#${String(job.id)}`}
                  />
                  <DetailRow
                    icon={<IconBolt size={13} />}
                    tone="bg-sky-500/15 text-[var(--color-blue)]"
                    label="Status"
                    value={STATUS_LABEL[job.status]}
                  />
                  <DetailRow
                    icon={<IconUser size={13} />}
                    tone="bg-blue-500/15 text-[var(--color-blue)]"
                    label="Client"
                    value={<span className="font-mono">{shortAddr(job.client, 6)}</span>}
                  />
                  <DetailRow
                    icon={<IconClock size={13} />}
                    tone="bg-amber-500/15 text-[var(--color-orange)]"
                    label="End date"
                    value={new Date(Number(job.expiredAt) * 1000).toLocaleString()}
                  />
                  {job.submittedAt > 0n && (
                    <DetailRow
                      icon={<IconSend size={13} />}
                      tone="bg-violet-500/15 text-[var(--color-violet)]"
                      label="Submitted"
                      value={new Date(Number(job.submittedAt) * 1000).toLocaleString()}
                    />
                  )}
                  {job.resolvedAt > 0n && (
                    <DetailRow
                      icon={<IconCheckCircle size={13} />}
                      tone="bg-emerald-500/15 text-[var(--color-accent)]"
                      label="Resolved"
                      value={new Date(Number(job.resolvedAt) * 1000).toLocaleString()}
                    />
                  )}
                  {job.lastScoreTenths !== undefined && (
                    <DetailRow
                      icon={<IconStar size={13} />}
                      tone="bg-amber-500/15 text-[var(--color-orange)]"
                      label="Last rating"
                      value={`${formatScore(job.lastScoreTenths)}/10`}
                    />
                  )}
                </dl>
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)]/60 p-4">
                  <h3 className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    <span className="icon-chip h-5 w-5 bg-violet-500/15 text-[var(--color-violet)]">
                      <IconDoc size={11} />
                    </span>
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text)]/85">
                    {description ? linkifyText(description) : "—"}
                  </p>
                </div>
              </section>

              <div className="space-y-0.5 md:space-y-4">
                <section className="panel rounded-md p-1 md:rounded-xl md:p-5">
                  <h2 className="mb-3.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    <span className="icon-chip h-6 w-6 bg-white/5 text-[var(--color-muted)]">
                      <IconUsers size={12} />
                    </span>
                    Participants
                  </h2>
                  <div className="space-y-3.5">
                    <Person
                      role="Client"
                      primary={shortAddr(job.client, 6)}
                      icon={<IconUser size={13} />}
                      tone="bg-blue-500/15 text-[var(--color-blue)]"
                    />
                    <Person
                      role="Evaluator"
                      primary={
                        job.agentId > 0n
                          ? `Agent #${String(job.agentId)}`
                          : applicants.length
                            ? `${applicants.length} pending`
                            : "Unassigned"
                      }
                      icon={<IconRobotHead size={13} />}
                      tone="bg-violet-500/15 text-[var(--color-violet)]"
                      secondary={
                        job.agentId > 0n
                          ? [
                              agent?.owner ? shortAddr(agent.owner, 4) : null,
                              scoreN != null ? `${scoreN.toFixed(1)}/10` : null,
                              agent?.stake ? `${formatUsdc(agent.stake)} stake` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : undefined
                      }
                      href={job.agentId > 0n ? `/agents/${job.agentId}` : undefined}
                    />
                    <Person
                      role="Provider"
                      primary={isZero(job.provider) ? "Unclaimed" : shortAddr(job.provider, 6)}
                      icon={<IconBriefcase size={13} />}
                      tone="bg-amber-500/15 text-[var(--color-orange)]"
                    />
                  </div>
                </section>

                <section className="panel rounded-md p-1 md:rounded-xl md:p-5">
                  <h2 className="mb-3.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    <span className="icon-chip h-6 w-6 bg-white/5 text-[var(--color-muted)]">
                      <IconWallet size={12} />
                    </span>
                    Financials
                  </h2>
                  <div className="space-y-2.5 text-xs">
                    <FinRow
                      icon={<IconCoin size={12} />}
                      tone="text-[var(--color-accent)]"
                      label="Budget"
                      value={`${formatUsdc(job.budget)} USDC`}
                    />
                    {job.status === JobStatus.Cancelled ? (
                      <>
                        <FinRow
                          icon={<IconWallet size={12} />}
                          tone="text-[var(--color-blue)]"
                          label="Client refund"
                          value={`${formatUsdc(job.budget - paidCancelFee)} USDC`}
                        />
                        <FinRow
                          icon={<IconStar size={12} />}
                          tone="text-[var(--color-orange)]"
                          label={`Cancel fee (${CANCEL_FEE_BP / 100}%)`}
                          value={
                            paidCancelFee > 0n
                              ? `${formatUsdc(paidCancelFee)} USDC → evaluator`
                              : "0 USDC"
                          }
                        />
                      </>
                    ) : job.status === JobStatus.Rejected ? (
                      <FinRow
                        icon={<IconWallet size={12} />}
                        tone="text-[var(--color-blue)]"
                        label="Client refund"
                        value={`${formatUsdc(job.budget)} USDC`}
                      />
                    ) : job.status === JobStatus.Completed ? (
                      <>
                        <FinRow
                          icon={<IconBriefcase size={12} />}
                          tone="text-[var(--color-orange)]"
                          label="Provider paid"
                          value={`${formatUsdc(job.budget - fee)} USDC`}
                        />
                        <FinRow
                          icon={<IconStar size={12} />}
                          tone="text-[var(--color-violet)]"
                          label="Evaluator fee"
                          value={`${formatUsdc(fee)} USDC`}
                        />
                      </>
                    ) : (
                      <>
                        <FinRow
                          icon={<IconLock size={12} />}
                          tone="text-[var(--color-violet)]"
                          label="Bond"
                          value={`${formatUsdc(bondAmt)} USDC${bondIsLocked ? " · locked" : ""}`}
                        />
                        <FinRow
                          icon={<IconStar size={12} />}
                          tone="text-[var(--color-orange)]"
                          label="Fee (on complete)"
                          value={`${formatUsdc(fee)} USDC`}
                        />
                      </>
                    )}
                    <div className="border-t border-[var(--color-line)] pt-2.5">
                      <FinRow
                        icon={<IconLock size={12} />}
                        tone="text-[var(--color-accent)]"
                        label="Total locked"
                        value={`${formatUsdc(totalLocked)} USDC`}
                        strong
                      />
                    </div>
                  </div>
                  <a
                    href={`https://testnet.arcscan.app/address/${addresses.settleNet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] text-[var(--color-accent)] hover:underline"
                  >
                    View on Explorer →
                  </a>
                </section>
              </div>
            </div>
          )}

          {tab === "application" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Agent application</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                    Pending applicants wait for client approve or reject.
                  </p>
                </div>
                {hasApplication && (
                  <AppStatusChip pending={job.status === JobStatus.AgentPending && applicants.length > 0} />
                )}
              </div>

              {!hasApplication ? (
                <div className="panel rounded-xl px-4 py-8 text-center">
                  <span className="icon-chip mx-auto mb-2 h-10 w-10 bg-violet-500/15 text-[var(--color-violet)]">
                    <IconRobotHead size={18} />
                  </span>
                  <p className="text-sm font-medium">No application yet</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                    An active agent owner can apply from Actions.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {job.agentId > 0n && (
                    <li className="panel flex items-center gap-3 rounded-xl border-l-[3px] border-l-[var(--color-accent)] px-1 py-1 md:px-3.5 md:py-3.5">
                      <RobotIcon seed={job.agentId} size={44} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/agents/${job.agentId}`}
                          className="text-[15px] font-semibold leading-snug hover:text-[var(--color-accent)]"
                        >
                          Agent #{String(job.agentId)}
                        </Link>
                        <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
                          {agent?.owner ? shortAddr(agent.owner, 5) : "—"}
                          {scoreN != null && ` · ${scoreN.toFixed(1)}/10`}
                          {agent ? ` · ${agent.ratingCount} rating${agent.ratingCount === 1 ? "" : "s"}` : ""}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-[10px] font-bold uppercase text-[var(--color-accent)]">
                        <IconCheckCircle size={10} /> Approved
                      </span>
                      <Link
                        to={`/agents/${job.agentId}`}
                        className="ghost-btn inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px]"
                      >
                        Profile <IconArrowRight size={12} />
                      </Link>
                    </li>
                  )}
                  {applicants.map((id) => {
                    const row = indexed?.agents.find((a) => a.id === id);
                    const score = row ? Number(row.scoreTenths) / 10 : null;
                    return (
                      <li
                        key={String(id)}
                        className="panel flex items-center gap-3 rounded-xl border-l-[3px] border-l-[var(--color-violet)] px-1 py-1 md:px-3.5 md:py-3.5"
                      >
                        <RobotIcon seed={id} size={44} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/agents/${id}`}
                            className="text-[15px] font-semibold leading-snug hover:text-[var(--color-accent)]"
                          >
                            Agent #{String(id)}
                          </Link>
                          <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
                            {row?.owner ? shortAddr(row.owner, 5) : "—"}
                            {score != null && ` · ${score.toFixed(1)}/10`}
                            {row ? ` · ${row.ratingCount} rating${row.ratingCount === 1 ? "" : "s"}` : ""}
                          </div>
                        </div>
                        {isClient && job.status === JobStatus.AgentPending ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={isPending}
                              className="accent-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                              onClick={() =>
                                void run(
                                  () =>
                                    writeContractAsync({
                                      ...contracts.settleNet,
                                      functionName: "approveAgent",
                                      args: [job.id, id],
                                    }),
                                  {
                                    action: `Approving Agent #${id}`,
                                    success: "Evaluator approved",
                                    detail: `Agent #${id} · job open`,
                                  },
                                )
                              }
                            >
                              <IconCheckCircle size={14} /> Accept
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              className="danger-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                              onClick={() =>
                                void run(
                                  () =>
                                    writeContractAsync({
                                      ...contracts.settleNet,
                                      functionName: "rejectAgent",
                                      args: [job.id, id],
                                    }),
                                  {
                                    action: `Rejecting Agent #${id}`,
                                    success: "Application rejected",
                                    detail: `Agent #${id}`,
                                  },
                                )
                              }
                            >
                              <IconX size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <Link
                            to={`/agents/${id}`}
                            className="ghost-btn inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px]"
                          >
                            Profile <IconArrowRight size={12} />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {rejectedApps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--color-muted)]">
                    Rejection history
                  </h3>
                  <ul className="space-y-2">
                    {rejectedApps.map((r) => {
                      const score = r.agent ? Number(r.agent.scoreTenths) / 10 : null;
                      return (
                        <li
                          key={`${String(r.agentId)}-${r.at}`}
                          className="panel flex items-center gap-3 rounded-xl border-l-[3px] border-l-red-400/70 px-1 py-1 md:px-3.5 md:py-3.5"
                        >
                          <RobotIcon seed={r.agentId} size={44} />
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/agents/${r.agentId}`}
                              className="text-[15px] font-semibold leading-snug hover:text-[var(--color-accent)]"
                            >
                              Agent #{String(r.agentId)}
                            </Link>
                            <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
                              {r.agent?.owner ? shortAddr(r.agent.owner, 5) : "—"}
                              {score != null && ` · ${score.toFixed(1)}/10`}
                              {r.agent
                                ? ` · ${r.agent.ratingCount} rating${r.agent.ratingCount === 1 ? "" : "s"}`
                                : ""}
                              {` · ${relativeTime(r.at)}`}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-500/15 px-2 py-1.5 text-[10px] font-bold uppercase text-red-300">
                            <IconX size={10} /> Rejected
                          </span>
                          <Link
                            to={`/agents/${r.agentId}`}
                            className="ghost-btn inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px]"
                          >
                            Profile <IconArrowRight size={12} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {tab === "submission" && (
            <section className="panel space-y-3 rounded-md p-1 md:rounded-xl md:p-3.5">
              <div>
                <h2 className="text-sm font-semibold">Submission</h2>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  Deliverable URL, notes, or write-up for the evaluator.
                </p>
              </div>
              {job.submission ? (
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)]/60 p-3.5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-text)]/90">
                    {linkifyText(job.submission)}
                  </pre>
                </div>
              ) : isProvider && job.status === JobStatus.Claimed ? (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "submit",
                          args: [job.id, submission],
                        }),
                      { action: "Submitting work…", success: "Work submitted", detail: `Job #${job.id}` },
                    );
                  }}
                >
                  <textarea
                    required
                    rows={12}
                    value={submission}
                    onChange={(e) => setSubmission(e.target.value)}
                    placeholder={"Deliverable URL\n\nWhat you shipped\nHow to verify\nNotes for the evaluator"}
                    className="field min-h-[220px] resize-y text-sm leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !submission.trim()}
                    className="accent-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
                  >
                    <IconDoc size={15} /> Submit work
                  </button>
                </form>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">No submission yet.</p>
              )}
            </section>
          )}

          {tab === "activity" &&
            (jobActivity.length === 0 ? (
              <section className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
                <p className="text-xs text-[var(--color-muted)]">No indexed events for this job.</p>
              </section>
            ) : (
              <ul className="space-y-1.5">
                {jobActivity.map((item) => (
                  <WalletActivityRow key={item.id} item={item} />
                ))}
              </ul>
            ))}
        </div>

        <aside className="space-y-2.5 xl:sticky xl:top-4 xl:self-start">
          <section className="panel rounded-md p-1 md:rounded-xl md:p-4">
            <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Timeline
            </h2>
            <ol>
              {timeline.map((step, i) => (
                <li key={step.key} className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                        step.state === "done"
                          ? "bg-[var(--color-accent)] text-[#04140e]"
                          : step.state === "missed"
                            ? "bg-red-500/20 text-red-300"
                            : step.state === "current"
                              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/35"
                              : "bg-[var(--color-line)] text-[var(--color-muted)]"
                      }`}
                    >
                      {step.state === "done" ? "✓" : step.state === "missed" ? "✕" : ""}
                    </span>
                    {i < timeline.length - 1 && (
                      <span
                        className={`w-px min-h-6 flex-1 ${
                          step.state === "done"
                            ? "bg-[var(--color-accent)]/40"
                            : step.state === "missed"
                              ? "bg-red-500/25"
                              : "bg-[var(--color-line)]"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-4 text-xs">
                    <div
                      className={
                        step.state === "todo"
                          ? "text-[var(--color-muted)]"
                          : step.state === "missed"
                            ? "font-medium text-red-300"
                            : "font-medium text-[var(--color-text)]"
                      }
                    >
                      {step.label}
                    </div>
                    {step.at != null && step.at > 0 && (
                      <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                        {formatExpiryAt(BigInt(step.at))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel space-y-1.5 rounded-md p-1 md:rounded-xl md:p-3">
            <h2 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Actions
            </h2>

            {(job.status === JobStatus.Posted || job.status === JobStatus.AgentPending) &&
              !isClient &&
              (myAppliedId != null ? (
                <p className="rounded-lg border border-[var(--color-accent)]/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-[var(--color-accent)]">
                  Already applied with Agent #{String(myAppliedId)}
                </p>
              ) : (
                <ApplyAgentMenu
                  agents={eligibleAgents}
                  disabled={isPending}
                  onApply={(agentId) =>
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "applyAsAgent",
                          args: [job.id, agentId],
                        }),
                      {
                        action: `Applying Agent #${agentId}`,
                        success: "Agent applied",
                        detail: `Agent #${agentId} · Job #${job.id}`,
                      },
                    )
                  }
                />
              ))}

            {isClient && job.status === JobStatus.AgentPending && applicants.length > 0 && (
              <p className="text-[11px] text-[var(--color-muted)]">
                Review applicants in the Application tab to accept or reject.
              </p>
            )}

            {job.status === JobStatus.Open && !isClient && !isAgentOwner && (
              <button
                type="button"
                disabled={isPending}
                className="accent-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
                onClick={() =>
                  void run(async () => {
                    await claimJobWithBond(writeContractAsync, job.id, job.budget);
                  })
                }
              >
                <IconBriefcase size={14} /> Claim ({formatUsdc(bondReq)} bond)
              </button>
            )}

            {isProvider && job.status === JobStatus.Claimed && (
              <button
                type="button"
                onClick={() => setTab("submission")}
                className="accent-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
              >
                <IconDoc size={14} /> Write submission
              </button>
            )}

            {job.status === JobStatus.Submitted && (
              <>
                <button
                  type="button"
                  disabled={isPending || !isAgentOwner}
                  className="accent-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
                  onClick={() =>
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "complete",
                          args: [job.id],
                        }),
                      { action: "Completing job…", success: "Job completed", detail: `Job #${job.id}` },
                    )
                  }
                >
                  <IconCheckCircle size={14} /> Complete
                </button>
                <button
                  type="button"
                  disabled={isPending || !isAgentOwner}
                  className="danger-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
                  onClick={() =>
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "reject",
                          args: [job.id],
                        }),
                      { action: "Rejecting work…", success: "Work rejected", detail: `Job #${job.id}` },
                    )
                  }
                >
                  <IconX size={14} /> Reject work
                </button>
              </>
            )}

            {isClient &&
              (job.status === JobStatus.Completed || job.status === JobStatus.Rejected) &&
              (alreadyRated ? (
                <p className="text-xs text-[var(--color-accent)]">Evaluator already rated.</p>
              ) : (
                <form
                  className="space-y-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "rateEvaluator",
                          args: [job.id, Number(score)],
                        }),
                      { action: "Rating evaluator…", success: "Evaluator rated", detail: `${score}/10` },
                    );
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="field text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="accent-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
                  >
                    <IconStar size={14} /> Rate evaluator
                  </button>
                </form>
              ))}

            {isClient &&
              (job.status === JobStatus.Posted ||
                job.status === JobStatus.AgentPending ||
                job.status === JobStatus.Open) && (
                <button
                  type="button"
                  disabled={isPending}
                  className="ghost-btn w-full rounded-lg py-2 text-xs"
                  onClick={() =>
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.settleNet,
                          functionName: "cancelJob",
                          args: [job.id],
                        }),
                      {
                        action: "Cancelling job…",
                        success: "Job cancelled",
                        detail: `Job #${job.id}`,
                      },
                    )
                  }
                >
                  Cancel job
                  <span className="mt-0.5 block font-normal text-[10px] text-[var(--color-muted)]">
                    {job.status === JobStatus.Open
                      ? `Refund ${formatUsdc(job.budget - cancelPreviewFee)} · ${CANCEL_FEE_BP / 100}% fee to evaluator`
                      : `Full refund ${formatUsdc(job.budget)} USDC`}
                  </span>
                </button>
              )}

            {refundEligible && (
              <button
                type="button"
                disabled={isPending}
                className="ghost-btn w-full rounded-lg py-2 text-xs"
                onClick={() =>
                  void run(
                    () =>
                      writeContractAsync({
                        ...contracts.settleNet,
                        functionName: "claimRefund",
                        args: [job.id],
                      }),
                    {
                      action: "Claiming refund…",
                      success: "Refund claimed",
                      detail: `${formatUsdc(job.budget)} USDC · Job #${job.id}`,
                    },
                  )
                }
              >
                Claim refund
                <span className="mt-0.5 block font-normal text-[10px] text-[var(--color-muted)]">
                  {job.status === JobStatus.Submitted
                    ? "Ghost path: 20% provider · 80% client"
                    : "Full budget back to client (after expiry)"}
                </span>
              </button>
            )}

          </section>
        </aside>
      </div>
    </div>
  );
}

function AppStatusChip({ pending }: { pending: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
        pending
          ? "bg-amber-500/15 text-[var(--color-orange)]"
          : "bg-emerald-500/15 text-[var(--color-accent)]"
      }`}
    >
      {pending ? <IconClock size={10} /> : <IconCheckCircle size={10} />}
      {pending ? "Pending" : "Approved"}
    </span>
  );
}

function ApplyAgentMenu({
  agents,
  disabled,
  onApply,
}: {
  agents: IndexedAgent[];
  disabled?: boolean;
  onApply: (agentId: bigint) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (agents.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--color-line)] px-2.5 py-2 text-[11px] text-[var(--color-muted)]">
        No eligible agents. Need active, max budget/expiry fit, and enough available stake.
      </p>
    );
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="accent-btn flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs"
      >
        <IconUsers size={14} /> Apply as agent
        <IconChevronDown size={12} className={`opacity-80 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-56 overflow-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] py-1 shadow-xl">
          {agents.map((a) => (
            <button
              key={String(a.id)}
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onApply(a.id);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/[0.04]"
            >
              <span className="icon-chip h-7 w-7 shrink-0 bg-violet-500/15 text-[var(--color-violet)]">
                <IconRobotHead size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Agent #{String(a.id)}</span>
                <span className="block text-[10px] text-[var(--color-muted)]">
                  {formatScore(a.scoreTenths)}/10 · {formatUsdc(a.available)} avail
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function JobDetailSkeleton() {
  return (
    <div>
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
      <div className="mb-1.5 flex flex-wrap items-start md:mb-3 justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-16 animate-pulse rounded bg-white/[0.08]" />
            <span className="h-5 w-14 animate-pulse rounded-md bg-white/[0.06]" />
          </div>
          <div className="h-7 w-2/3 max-w-md animate-pulse rounded bg-white/[0.1]" />
          <div className="h-3 w-1/2 max-w-sm animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>

      <div className="mb-1 grid gap-0.5 grid-cols-2 md:mb-3 md:gap-2 xl:grid-cols-4">
        {JOB_METRIC_META.map((m) => (
          <div key={m.label} className="panel flex items-start gap-2.5 rounded-xl px-3 py-2.5">
            <span className={`icon-chip h-8 w-8 shrink-0 ${m.tone}`}>
              <m.icon size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{m.label}</div>
              <div className="mt-1 h-4 w-20 animate-pulse rounded bg-white/[0.1]" />
              <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-1.5 border-b border-[var(--color-line)] pb-0">
        {["Overview", "Application", "Submission", "Activity"].map((t, i) => (
          <span
            key={t}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium ${
              i === 0
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-muted)]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="panel space-y-3 rounded-md p-1 md:rounded-xl md:p-4">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/[0.1]" />
        <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.06]" />
        <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-2.5 w-3/5 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex justify-between gap-2 border-b border-[var(--color-line)] py-2">
              <span className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
              <span className="h-3 w-16 animate-pulse rounded bg-white/[0.1]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="panel flex items-start gap-2.5 rounded-xl px-3 py-2.5">
      <span className={`icon-chip h-8 w-8 shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
        <div className="text-sm font-bold tabular-nums leading-tight">{value}</div>
        {hint && <div className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">{hint}</div>}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)]/40 px-3 py-2.5">
      <span className={`icon-chip h-7 w-7 shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
        <dd className="truncate text-xs font-medium">{value}</dd>
      </div>
    </div>
  );
}

function FinRow({
  label,
  value,
  strong,
  icon,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex min-w-0 items-center gap-2.5 text-[var(--color-muted)]">
        <span className={tone}>{icon}</span>
        {label}
      </span>
      <span className={`tabular-nums ${strong ? "font-bold text-[var(--color-accent)]" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

function Person({
  role,
  primary,
  secondary,
  href,
  icon,
  tone,
}: {
  role: string;
  primary: string;
  secondary?: string;
  href?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`icon-chip h-8 w-8 shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{role}</div>
        {href ? (
          <Link to={href} className="text-xs font-medium text-[var(--color-accent)] hover:underline">
            {primary}
          </Link>
        ) : (
          <div className="text-xs font-medium">{primary}</div>
        )}
        {secondary && <div className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">{secondary}</div>}
      </div>
    </div>
  );
}
