import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { WalletActivityRow } from "@/components/activity/WalletActivityRow";
import { RobotIcon } from "@/components/agents/RobotIcon";
import { AmountChips } from "@/components/ui/AmountChips";
import { StatusBadge, JOB_STATUS_VISUAL } from "@/components/ui/StatusBadge";
import {
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
  IconBolt,
  IconBriefcase,
  IconCheckCircle,
  IconClock,
  IconCoin,
  IconLayout,
  IconList,
  IconPencil,
  IconPower,
  IconSend,
  IconShield,
  IconStar,
  IconUser,
  IconWallet,
} from "@/components/ui/Icons";
import { toastTx } from "@/components/ui/Toast";
import { addresses, contracts, USDC_DECIMALS } from "@/config/contracts";
import { useAgent, useWriteSettle, parseUsdcInput } from "@/hooks/useContracts";
import { useAgentMeta } from "@/hooks/useIdentity";
import { useJobs } from "@/hooks/useJobs";
import { useAgentLocked } from "@/hooks/useAgentLocked";
import { useAgentRatings } from "@/hooks/useActivity";
import { useIndexedState } from "@/hooks/useIndexedState";
import { fetchAgentTransfers } from "@/libs/arcscan";
import { toActivityItem, type WalletActivityItem } from "@/hooks/useWalletActivity";
import { JobStatus, type Job } from "@/types/job";
import { asBig, formatExpiryAt, formatScore, formatUsdc, jobTitle, relativeTime, shortAddr, timeLeft } from "@/utils/format";

function usdcInput(amount: bigint) {
  const s = formatUnits(amount, USDC_DECIMALS);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "") || "0";
}

type Tab = "overview" | "jobs" | "ratings" | "stake" | "slash" | "activity";

const TABS: {
  id: Tab;
  label: string;
  Icon: typeof IconLayout;
}[] = [
  { id: "overview", label: "Overview", Icon: IconLayout },
  { id: "jobs", label: "Jobs", Icon: IconBriefcase },
  { id: "ratings", label: "Ratings", Icon: IconStar },
  { id: "stake", label: "Stake & Settings", Icon: IconWallet },
  { id: "slash", label: "Slash History", Icon: IconShield },
  { id: "activity", label: "Activity", Icon: IconList },
];

const ACTIVE_STATUSES = [
  JobStatus.AgentPending,
  JobStatus.Open,
  JobStatus.Claimed,
  JobStatus.Submitted,
];

const STAKE_CARD_META = [
  { label: "Total Stake", Icon: IconCoin, tone: "bg-emerald-500/15 text-[var(--color-accent)]" },
  { label: "Settled Vol", Icon: IconCheckCircle, tone: "bg-violet-500/15 text-[var(--color-violet)]" },
  { label: "Available Stake", Icon: IconWallet, tone: "bg-sky-500/15 text-[var(--color-blue)]" },
  { label: "Pending Slash", Icon: IconShield, tone: "bg-red-500/15 text-red-300" },
] as const;

function statusLabel(agent: {
  retired: boolean;
  pendingSlash: boolean;
  active: boolean;
  offline: boolean;
}) {
  if (agent.retired) return { text: "Retired", tone: "bg-white/10 text-[var(--color-muted)]" };
  if (agent.pendingSlash) return { text: "Pending slash", tone: "bg-red-500/15 text-red-300" };
  if (agent.active) return { text: "Active", tone: "bg-emerald-500/15 text-[var(--color-accent)]" };
  if (agent.offline) return { text: "Offline", tone: "bg-amber-500/15 text-[var(--color-orange)]" };
  return { text: "Inactive", tone: "bg-white/10 text-[var(--color-muted)]" };
}

function scoreBucket(scoreTenths: number): 1 | 2 | 3 | 4 | 5 {
  const s = scoreTenths / 10;
  if (s >= 9) return 5;
  if (s >= 7) return 4;
  if (s >= 5) return 3;
  if (s >= 3) return 2;
  return 1;
}

export function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agentId = id ? BigInt(id) : undefined;
  const { address, isConnected } = useAccount();
  const { agent, isLoading, refetch } = useAgent(agentId);
  const { data: meta } = useAgentMeta(agent?.name ? undefined : agentId);
  const { jobs } = useJobs();
  const { data: indexed } = useIndexedState();
  const { locked, jobLocks } = useAgentLocked(agentId);
  const { data: ratings = [] } = useAgentRatings(agentId, 80);
  const { writeContractAsync, isPending } = useWriteSettle();

  const [tab, setTab] = useState<Tab>("overview");
  const [stakeSub, setStakeSub] = useState<"stake" | "settings">("stake");
  const [stakeAmt, setStakeAmt] = useState("10");
  const [withdrawAmt, setWithdrawAmt] = useState("1");
  const [maxBudget, setMaxBudget] = useState("");
  const [maxDays, setMaxDays] = useState("14");
  const [transferTo, setTransferTo] = useState("");
  const [editing, setEditing] = useState<"budget" | "expiry" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner =
    !!address && !!agent?.owner && address.toLowerCase() === agent.owner.toLowerCase();

  const agentJobs = useMemo(
    () => (agentId ? jobs.filter((j) => j.agentId === agentId) : []),
    [jobs, agentId],
  );

  const completed =
    agent?.completedJobs ?? agentJobs.filter((j) => j.status === JobStatus.Completed).length;
  const rejected = agentJobs.filter((j) => j.status === JobStatus.Rejected).length;
  const ghosts = agent?.ghostJobs ?? 0;
  const inProgress =
    agent?.activeJobs ?? agentJobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;
  const activeJobs = agentJobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const resolved = completed + rejected + ghosts;
  const successRate = resolved > 0 ? Math.round((completed / resolved) * 100) : 0;

  const lockedAmt = agent?.locked ?? locked;
  const stake = agent?.stake ?? 0n;
  const available = agent?.available ?? (stake > lockedAmt ? stake - lockedAmt : 0n);
  const scoreLabel = agent ? formatScore(agent.score) : "0.0";
  const ratingCount = agent?.ratingCount ?? ratings.length;

  const slashEvents = useMemo(() => {
    if (!agentId || !indexed) return [];
    return indexed.stakeLogs
      .filter(
        (e) =>
          (e.eventName === "Slashed" || e.eventName === "PendingSlash") &&
          e.args.agentId != null &&
          BigInt(e.args.agentId as bigint | string | number) === agentId,
      )
      .sort((a, b) => b.at - a.at)
      .map((e) => ({
        id: `${e.txHash}-${e.logIndex}`,
        kind: e.eventName as "Slashed" | "PendingSlash",
        amount: asBig(e.args.amount),
        at: e.at,
        tx: e.txHash,
      }));
  }, [indexed, agentId]);

  const stakeHistory = useMemo(() => {
    if (!agentId || !indexed) return [];
    return indexed.stakeLogs
      .filter(
        (e) =>
          (e.eventName === "AgentStaked" || e.eventName === "Withdrawn") &&
          e.args.agentId != null &&
          BigInt(e.args.agentId as bigint | string | number) === agentId,
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, 12)
      .map((e) => {
        if (e.eventName === "Withdrawn") {
          return {
            id: `${e.txHash}-${e.logIndex}`,
            title: "Stake Withdrawn",
            detail: `${formatUsdc(asBig(e.args.amount))} USDC`,
            at: e.at,
            tx: e.txHash,
          };
        }
        return {
          id: `${e.txHash}-${e.logIndex}`,
          title: "Stake Added",
          detail: `${formatUsdc(asBig(e.args.total))} USDC total`,
          at: e.at,
          tx: e.txHash,
        };
      });
  }, [indexed, agentId]);

  const pendingSlashAmt =
    slashEvents.find((e) => e.kind === "PendingSlash")?.amount ?? 0n;

  const ratingDist = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) counts[scoreBucket(r.scoreTenths)]++;
    const total = ratings.length || 1;
    return ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      count: counts[stars],
      pct: (counts[stars] / total) * 100,
    }));
  }, [ratings]);

  const { data: identityTransfers = [] } = useQuery({
    queryKey: ["agent-transfers", addresses.identity, String(agentId ?? "")],
    enabled: agentId != null && agentId > 0n,
    staleTime: 60_000,
    queryFn: () => fetchAgentTransfers(agentId!),
  });

  const activity = useMemo(() => {
    if (!agentId || !indexed) return [] as WalletActivityItem[];
    const settle = indexed.settleLogs.filter((e) => {
      if (e.args.agentId != null && BigInt(e.args.agentId as bigint | string | number) === agentId)
        return true;
      if (e.args.jobId == null) return false;
      const j = indexed.jobs.find(
        (x) => x.id === BigInt(e.args.jobId as bigint | string | number),
      );
      return j?.agentId === agentId;
    });
    const stakeEv = indexed.stakeLogs.filter(
      (e) =>
        e.args.agentId != null &&
        BigInt(e.args.agentId as bigint | string | number) === agentId,
    );
    return [
      ...settle.map((e) => toActivityItem(e, "settle", true)),
      ...stakeEv.map((e) => toActivityItem(e, "stake", true)),
      ...identityTransfers.map((e) => toActivityItem(e, "identity", true)),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 40);
  }, [indexed, agentId, identityTransfers]);

  const run = async (
    fn: () => Promise<unknown>,
    t?: { action: string; success: string; detail?: string },
  ) => {
    setMsg(null);
    try {
      if (t) await toastTx(t, fn);
      else await fn();
      await refetch();
      setEditing(null);
    } catch {}
  };

  if (!agentId) return <p className="text-sm text-[var(--color-muted)]">Invalid agent</p>;
  if (isLoading && !agent) return <AgentDetailSkeleton agentId={agentId} />;
  if (!agent) return <p className="text-sm text-[var(--color-muted)]">Agent not found</p>;

  const badge = statusLabel(agent);
  const stakeTotal = stake > 0n ? stake : 1n;
  const availPct = Number((available * 10000n) / stakeTotal) / 100;
  const lockedPct = Number((lockedAmt * 10000n) / stakeTotal) / 100;

  const goStake = () => {
    setTab("stake");
    setStakeSub("stake");
  };
  const goSettings = (field?: "budget" | "expiry") => {
    setTab("stake");
    setStakeSub("settings");
    if (field) setEditing(field);
  };

  const displayName = agent.name?.trim() || meta?.name?.trim() || `Agent #${String(agentId)}`;

  return (
    <div className="space-y-0.5 md:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <Link to="/agents" className="hover:text-[var(--color-accent)]">
              Agents
            </Link>
            <span>/</span>
            <span>Agent #{String(agentId)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight md:text-2xl">
              {displayName}
            </h1>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${badge.tone}`}>
              {badge.text}
            </span>
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={goStake}
            className="ghost-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <IconPencil size={14} />
            Edit Settings
          </button>
        )}
      </div>

      <section className="panel rounded-md p-1 md:rounded-xl md:p-3.5 md:p-4">
        <div className="flex flex-col gap-1.5 md:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <RobotIcon seed={agentId} size={72} />
            <div className="min-w-0 space-y-1.5">
              <div>
                <div className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight">
                  {displayName}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-muted)]">
                  <span>
                    Owner{" "}
                    <span className="font-mono text-[var(--color-text)]">
                      {shortAddr(agent.owner, 5)}
                    </span>
                  </span>
                  <span>
                    Agent NFT <span className="text-[var(--color-violet)]">ERC-8004</span>
                  </span>
                  <span>
                    Token ID <span className="text-[var(--color-text)]">#{String(agentId)}</span>
                  </span>
                </div>
              </div>
              {meta?.description?.trim() && (
                <p className="max-w-xl text-[12px] leading-snug text-[var(--color-muted)]">
                  {meta.description.trim()}
                </p>
              )}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-0.5 md:gap-x-6 md:gap-y-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Average Rating"
              value={`${scoreLabel} / 10`}
              sub={`${ratingCount} rating${ratingCount === 1 ? "" : "s"}`}
            />
            <Metric label="Jobs Completed" value={String(completed)} />
            <Metric label="Jobs In Progress" value={String(inProgress)} />
            <Metric label="Success Rate" value={`${successRate}%`} sub="completed / resolved" />
          </div>
        </div>
      </section>

      <div className="flex gap-0.5 overflow-x-auto no-scrollbar border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition ${
              tab === t.id
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

          {tab === "overview" && (
        <div className="space-y-0.5 md:space-y-3">
          <StakeMetrics
            stake={stake}
            settledVol={agent.settledVol}
            available={available}
            pendingSlashAmt={pendingSlashAmt}
          />

          <div className="grid gap-1.5 md:gap-3 lg:grid-cols-2">
            <StakeDonut
              title="Stake Details"
              stake={stake}
              available={available}
              lockedAmt={lockedAmt}
              availPct={availPct}
              lockedPct={lockedPct}
              locks={jobLocks}
            />

            <div className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
              <h3 className="mb-3 text-sm font-semibold">Rating Distribution</h3>
              {ratings.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No ratings yet (default score 6.0/10).</p>
              ) : (
                <ul className="space-y-1.5">
                  {ratingDist.map((r) => (
                    <li key={r.stars} className="flex items-center gap-2 text-[11px]">
                      <span className="w-6 tabular-nums text-[var(--color-muted)]">{r.stars}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${Math.max(r.pct, r.count ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right tabular-nums text-[var(--color-muted)]">
                        {r.count} · {r.pct.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-1.5 md:gap-3 lg:grid-cols-2">
            <div className="panel space-y-1 rounded-md p-1 md:rounded-xl md:p-3">
              <h3 className="mb-1.5 text-sm font-semibold">Agent Settings</h3>
              <SettingsRow
                label="Max Budget per Job"
                value={agent.maxBudget > 0n ? `${formatUsdc(agent.maxBudget)} USDC` : "—"}
                Icon={IconCoin}
                tone="bg-emerald-500/20 text-[var(--color-accent)]"
                onEdit={isOwner ? () => goSettings("budget") : undefined}
              />
              <SettingsRow
                label="Max Expiry Duration"
                value={agent.maxExpiry > 0n ? `${Number(agent.maxExpiry) / 86400} days` : "—"}
                Icon={IconClock}
                tone="bg-sky-500/20 text-[var(--color-blue)]"
                onEdit={isOwner ? () => goSettings("expiry") : undefined}
              />
              <SettingsRow
                label="Status"
                value={badge.text}
                Icon={IconBolt}
                tone="bg-[var(--color-violet)]/20 text-[var(--color-violet)]"
              />
              <SettingsRow
                label="Offline Mode"
                value={agent.offline ? "Yes" : "No"}
                Icon={IconPower}
                tone={
                  agent.offline
                    ? "bg-amber-500/20 text-[var(--color-orange)]"
                    : "bg-emerald-500/20 text-[var(--color-accent)]"
                }
              />

              {isOwner && (
                <div className="space-y-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={goStake}
                    className="accent-btn flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-sm"
                  >
                    <IconArrowUp size={14} />
                    Increase Stake
                  </button>
                  <button
                    type="button"
                    onClick={goStake}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/15 py-1.5 text-sm font-semibold text-[var(--color-blue)] hover:bg-blue-500/25"
                  >
                    <IconArrowDown size={14} />
                    Withdraw Stake
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    className="ghost-btn flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-sm"
                    onClick={() =>
                      void run(
                        () =>
                          writeContractAsync({
                            ...contracts.evaluatorStake,
                            functionName: "setOffline",
                            args: [agentId, !agent.offline],
                          }),
                        {
                          action: agent.offline ? "Going online…" : "Going offline…",
                          success: agent.offline ? "Agent online" : "Agent offline",
                          detail: `Agent #${agentId}`,
                        },
                      )
                    }
                  >
                    <IconPower size={14} />
                    {agent.offline ? "Go Online" : "Go Offline"}
                  </button>
                </div>
              )}
            </div>

            <div className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recent Ratings</h3>
                <button
                  type="button"
                  className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                  onClick={() => setTab("ratings")}
                >
                  View all
                </button>
              </div>
              {ratings.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No EvaluatorRated events yet.</p>
              ) : (
                <ul className="space-y-2">
                  {ratings.slice(0, 5).map((r) => {
                    const job = agentJobs.find((j) => j.id === r.jobId);
                    return (
                      <RatingRow
                        key={`${r.tx}-${String(r.jobId)}`}
                        jobId={r.jobId}
                        scoreTenths={r.scoreTenths}
                        at={r.at}
                        title={job ? jobTitle(job.title, job.description) : undefined}
                        compact
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <ActiveJobsTable jobs={activeJobs} />
        </div>
      )}

      {tab === "jobs" && (
        <div className="panel overflow-hidden rounded-xl">
          {agentJobs.length === 0 ? (
            <Empty>No jobs linked to this agent.</Empty>
          ) : (
            <JobsTable jobs={agentJobs} />
          )}
        </div>
      )}

      {tab === "ratings" &&
        (ratings.length === 0 ? (
          <div className="panel rounded-xl">
            <Empty>No ratings yet.</Empty>
          </div>
        ) : (
          <ul className="space-y-2">
            {ratings.map((r) => {
              const job = agentJobs.find((j) => j.id === r.jobId);
              return (
                <RatingRow
                  key={`${r.tx}-${String(r.jobId)}`}
                  jobId={r.jobId}
                  scoreTenths={r.scoreTenths}
                  at={r.at}
                  title={job ? jobTitle(job.title, job.description) : undefined}
                />
              );
            })}
          </ul>
        ))}

      {tab === "stake" && (
        <div className="space-y-0.5 md:space-y-3">
          <div className="flex gap-1.5">
            {(["stake", "settings"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStakeSub(s)}
                className={`tab capitalize ${stakeSub === s ? "tab-active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>

          {!isOwner && (
            <p className="text-sm text-[var(--color-muted)]">
              Only the ERC-8004 owner can manage stake and settings.
            </p>
          )}

          {stakeSub === "stake" && (
            <div className="space-y-0.5 md:space-y-3">
              <StakeMetrics
                stake={stake}
                settledVol={agent.settledVol}
                available={available}
                pendingSlashAmt={pendingSlashAmt}
              />

              <div className="grid gap-1.5 md:gap-3 lg:grid-cols-2">
                <StakeDonut
                  title="Stake Breakdown"
                  stake={stake}
                  available={available}
                  lockedAmt={lockedAmt}
                  availPct={availPct}
                  lockedPct={lockedPct}
                  locks={jobLocks}
                />

                <div className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
                  <h3 className="mb-3 text-sm font-semibold">Stake History</h3>
                  {stakeHistory.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted)]">No stake events yet.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--color-line)]">
                      {stakeHistory.map((h) => (
                        <li key={h.id} className="flex items-center gap-2 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{h.title}</div>
                            <div className="truncate text-[10px] text-[var(--color-muted)]">
                              {h.detail && `${h.detail} · `}
                              {relativeTime(h.at)} · {shortAddr(h.tx, 4)}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--color-accent)]">
                            Success
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="grid gap-3 md:grid-cols-3">
                  <form
                    className="panel space-y-2 rounded-md p-1 md:rounded-xl md:p-3.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const amount = parseUsdcInput(stakeAmt);
                      void run(async () => {
                        await toastTx(
                          {
                            action: "Approve USDC",
                            success: "USDC approved",
                            detail: `${formatUsdc(amount)} USDC`,
                          },
                          () =>
                            writeContractAsync({
                              ...contracts.usdc,
                              functionName: "approve",
                              args: [addresses.evaluatorStake, amount],
                            }),
                        );
                        await toastTx(
                          {
                            action: "Staking…",
                            success: "Stake increased",
                            detail: `${formatUsdc(amount)} USDC staked`,
                          },
                          () =>
                            writeContractAsync({
                              ...contracts.evaluatorStake,
                              functionName: "stake",
                              args: [agentId, amount],
                            }),
                        );
                      });
                    }}
                  >
                    <h3 className="text-sm font-semibold">Increase Stake</h3>
                    <p className="text-[10px] text-[var(--color-muted)]">Approve USDC then stake on EvaluatorStake</p>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={stakeAmt}
                      onChange={(e) => setStakeAmt(e.target.value)}
                      className="field"
                    />
                    <AmountChips value={stakeAmt} onPick={setStakeAmt} />
                    <button type="submit" disabled={isPending || !isConnected} className="accent-btn w-full rounded-lg py-2 text-sm">
                      Increase Stake
                    </button>
                  </form>

                  <form
                    className="panel space-y-2 rounded-md p-1 md:rounded-xl md:p-3.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        () =>
                          writeContractAsync({
                            ...contracts.evaluatorStake,
                            functionName: "withdraw",
                            args: [agentId, parseUsdcInput(withdrawAmt)],
                          }),
                        {
                          action: "Withdrawing stake…",
                          success: "Stake withdrawn",
                          detail: `${formatUsdc(parseUsdcInput(withdrawAmt))} USDC`,
                        },
                      );
                    }}
                  >
                    <h3 className="text-sm font-semibold">Withdraw Stake</h3>
                    <p className="text-[10px] text-[var(--color-muted)]">
                      Available {formatUsdc(available)} USDC
                    </p>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={withdrawAmt}
                      onChange={(e) => setWithdrawAmt(e.target.value)}
                      className="field"
                    />
                    <AmountChips
                      value={withdrawAmt}
                      onPick={setWithdrawAmt}
                      options={[
                        { label: "10%", value: usdcInput(available / 10n) },
                        { label: "50%", value: usdcInput(available / 2n) },
                        { label: "Max", value: usdcInput(available) },
                      ]}
                    />
                    <button type="submit" disabled={isPending || !isConnected} className="ghost-btn w-full rounded-lg py-2 text-sm">
                      Withdraw Stake
                    </button>
                  </form>

                  <div className="panel space-y-2 rounded-md p-1 md:rounded-xl md:p-3.5">
                    <h3 className="text-sm font-semibold">{agent.offline ? "Go Online" : "Go Offline"}</h3>
                    <p className="text-[10px] text-[var(--color-muted)]">Status · {badge.text}</p>
                    <div className="flex-1" />
                    <button
                      type="button"
                      disabled={isPending}
                      className="ghost-btn w-full rounded-lg py-2 text-sm"
                      onClick={() =>
                        void run(
                          () =>
                            writeContractAsync({
                              ...contracts.evaluatorStake,
                              functionName: "setOffline",
                              args: [agentId, !agent.offline],
                            }),
                          {
                            action: agent.offline ? "Going online…" : "Going offline…",
                            success: agent.offline ? "Agent online" : "Agent offline",
                            detail: `Agent #${agentId}`,
                          },
                        )
                      }
                    >
                      {agent.offline ? "Go Online" : "Go Offline"}
                    </button>
                    {agent.pendingSlash && (
                      <button
                        type="button"
                        disabled={isPending}
                        className="danger-btn w-full rounded-lg py-2 text-sm"
                        onClick={() =>
                          void run(
                            () =>
                              writeContractAsync({
                                ...contracts.evaluatorStake,
                                functionName: "finalizePendingSlash",
                                args: [agentId],
                              }),
                            {
                              action: "Finalizing slash…",
                              success: "Slash finalized",
                              detail: `Agent #${agentId}`,
                            },
                          )
                        }
                      >
                        Finalize pending slash
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {stakeSub === "settings" && (
            <div className="panel max-w-lg space-y-0.5 md:space-y-3 rounded-xl p-4">
              <h3 className="text-sm font-semibold">Agent Settings</h3>
              {!isOwner ? (
                <div className="space-y-1">
                  <SettingsRow
                    label="Max Budget per Job"
                    value={agent.maxBudget > 0n ? `${formatUsdc(agent.maxBudget)} USDC` : "—"}
                    Icon={IconCoin}
                    tone="bg-emerald-500/20 text-[var(--color-accent)]"
                  />
                  <SettingsRow
                    label="Max Expiry Duration"
                    value={agent.maxExpiry > 0n ? `${Number(agent.maxExpiry) / 86400} days` : "—"}
                    Icon={IconClock}
                    tone="bg-sky-500/20 text-[var(--color-blue)]"
                  />
                  <SettingsRow
                    label="Offline Mode"
                    value={agent.offline ? "On" : "Off"}
                    Icon={IconPower}
                    tone={
                      agent.offline
                        ? "bg-amber-500/20 text-[var(--color-orange)]"
                        : "bg-emerald-500/20 text-[var(--color-accent)]"
                    }
                  />
                </div>
              ) : (
                <>
                  <SettingBlock
                    Icon={IconCoin}
                    tone="bg-emerald-500/20 text-[var(--color-accent)]"
                    title="Max Budget per Job"
                    hint="Idle only · USDC"
                  >
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          () =>
                            writeContractAsync({
                              ...contracts.evaluatorStake,
                              functionName: "setMaxBudget",
                              args: [agentId, parseUsdcInput(maxBudget || "0")],
                            }),
                          {
                            action: "Updating max budget…",
                            success: "Max budget updated",
                            detail: `${maxBudget || "0"} USDC`,
                          },
                        );
                      }}
                    >
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={maxBudget}
                          autoFocus={editing === "budget"}
                          placeholder={agent.maxBudget ? formatUsdc(agent.maxBudget, 0).replace(/,/g, "") : "1000"}
                          onChange={(e) => setMaxBudget(e.target.value)}
                          className="field"
                        />
                        <button type="submit" disabled={isPending} className="accent-btn shrink-0 rounded-lg px-3 py-2 text-sm">
                          Save
                        </button>
                      </div>
                      <AmountChips value={maxBudget} onPick={setMaxBudget} />
                    </form>
                  </SettingBlock>

                  <SettingBlock
                    Icon={IconClock}
                    tone="bg-sky-500/20 text-[var(--color-blue)]"
                    title="Max Expiry Duration"
                    hint="1–30 days · idle only"
                  >
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          () =>
                            writeContractAsync({
                              ...contracts.evaluatorStake,
                              functionName: "setMaxExpiryDuration",
                              args: [agentId, BigInt(Number(maxDays) * 86400)],
                            }),
                          {
                            action: "Updating max expiry…",
                            success: "Max expiry updated",
                            detail: `${maxDays} days`,
                          },
                        );
                      }}
                    >
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={maxDays}
                          autoFocus={editing === "expiry"}
                          onChange={(e) => setMaxDays(e.target.value)}
                          className="field"
                        />
                        <span className="flex items-center text-xs text-[var(--color-muted)]">days</span>
                        <button type="submit" disabled={isPending} className="accent-btn shrink-0 rounded-lg px-3 py-2 text-sm">
                          Save
                        </button>
                      </div>
                      <AmountChips
                        value={maxDays}
                        onPick={setMaxDays}
                        options={[
                          { label: "1 day", value: "1" },
                          { label: "7 days", value: "7" },
                          { label: "14 days", value: "14" },
                          { label: "30 days", value: "30" },
                        ]}
                      />
                    </form>
                  </SettingBlock>

                  <SettingBlock
                    Icon={IconPower}
                    tone={
                      agent.offline
                        ? "bg-amber-500/20 text-[var(--color-orange)]"
                        : "bg-emerald-500/20 text-[var(--color-accent)]"
                    }
                    title="Offline Mode"
                    hint={agent.offline ? "Agent is offline" : "Agent can receive jobs when active"}
                    trailing={
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          void run(
                            () =>
                              writeContractAsync({
                                ...contracts.evaluatorStake,
                                functionName: "setOffline",
                                args: [agentId, !agent.offline],
                              }),
                            {
                              action: agent.offline ? "Going online…" : "Going offline…",
                              success: agent.offline ? "Agent online" : "Agent offline",
                              detail: `Agent #${agentId}`,
                            },
                          )
                        }
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          agent.offline ? "bg-[var(--color-orange)]" : "bg-[var(--color-accent)]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                            agent.offline ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    }
                  />

                  <SettingBlock
                    Icon={IconSend}
                    tone="bg-red-500/15 text-red-300"
                    title="Transfer Agent NFT"
                    hint="Sends ERC-8004 ownership. Stake & settings stay with this agent."
                  >
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!address || !agentId) return;
                        const to = transferTo.trim() as `0x${string}`;
                        if (!isAddress(to)) {
                          setMsg("Enter a valid wallet address");
                          return;
                        }
                        if (to.toLowerCase() === address.toLowerCase()) {
                          setMsg("Cannot transfer to yourself");
                          return;
                        }
                        void run(
                          async () => {
                            await writeContractAsync({
                              ...contracts.identity,
                              functionName: "safeTransferFrom",
                              args: [address, to, agentId],
                            });
                            navigate("/agents");
                          },
                          {
                            action: "Transferring agent…",
                            success: "Agent transferred",
                            detail: `Agent #${agentId}`,
                          },
                        );
                      }}
                    >
                      <input
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        placeholder="0x…"
                        className="field font-mono text-xs"
                        spellCheck={false}
                      />
                      <button
                        type="submit"
                        disabled={isPending || !transferTo.trim()}
                        className="danger-btn shrink-0 rounded-lg px-3 py-2 text-sm"
                      >
                        Transfer
                      </button>
                    </form>
                  </SettingBlock>
                </>
              )}
            </div>
          )}

          {msg && <p className="text-sm text-red-300">{msg}</p>}
        </div>
      )}

      {tab === "slash" && (
        <div className="panel divide-y divide-[var(--color-line)] rounded-xl">
          {agent.pendingSlash && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-red-300">Pending slash</div>
                <div className="text-xs text-[var(--color-muted)]">
                  Finalize to prune locks and settle slash if still slashable
                </div>
              </div>
              {isOwner && (
                <button
                  type="button"
                  disabled={isPending}
                  className="danger-btn rounded-lg px-3 py-1.5 text-xs"
                  onClick={() =>
                    void run(
                      () =>
                        writeContractAsync({
                          ...contracts.evaluatorStake,
                          functionName: "finalizePendingSlash",
                          args: [agentId],
                        }),
                      {
                        action: "Finalizing slash…",
                        success: "Slash finalized",
                        detail: `Agent #${agentId}`,
                      },
                    )
                  }
                >
                  Finalize
                </button>
              )}
            </div>
          )}
          {slashEvents.length === 0 && !agent.pendingSlash ? (
            <Empty>No slash events for this agent.</Empty>
          ) : (
            slashEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <IconShield size={14} className="text-red-300" />
                  <span>{e.kind === "Slashed" ? "Slashed" : "Pending slash set"}</span>
                </div>
                <span className="tabular-nums">{formatUsdc(e.amount)} USDC</span>
                <span className="text-xs text-[var(--color-muted)]">{relativeTime(e.at)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "activity" && (
        activity.length === 0 ? (
          <div className="panel rounded-xl">
            <Empty>No recent on-chain activity.</Empty>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((item) => (
              <WalletActivityRow key={item.id} item={item} statusOpensTx />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function AgentDetailSkeleton({ agentId }: { agentId: bigint }) {
  return (
    <div className="space-y-0.5 md:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <Link to="/agents" className="hover:text-[var(--color-accent)]">
              Agents
            </Link>
            <span>/</span>
            <span>Agent #{String(agentId)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7 w-40 animate-pulse rounded bg-white/[0.1]" />
            <span className="h-5 w-14 animate-pulse rounded-md bg-white/[0.06]" />
          </div>
        </div>
      </div>

      <section className="panel rounded-md p-1 md:rounded-xl md:p-3.5 md:p-4">
        <div className="flex flex-col gap-1.5 md:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="min-w-0 space-y-2 pt-1">
              <div className="h-5 w-36 animate-pulse rounded bg-white/[0.1]" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-44 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-0.5 md:gap-x-6 md:gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {["Average Rating", "Jobs Completed", "Jobs In Progress", "Success Rate"].map((label) => (
              <div key={label}>
                <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
                <div className="mt-1 h-5 w-12 animate-pulse rounded bg-white/[0.1]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex gap-0.5 overflow-x-auto no-scrollbar border-b border-[var(--color-line)]">
        {TABS.map((t, i) => (
          <span
            key={t.id}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${
              i === 0
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-muted)]"
            }`}
          >
            <t.Icon size={13} />
            {t.label}
          </span>
        ))}
      </div>

      <div className="space-y-0.5 md:space-y-3">
              <div className="mb-2 grid grid-cols-2 gap-1.5 md:mb-3 md:gap-2 xl:grid-cols-4">
          {STAKE_CARD_META.map((c) => (
            <div key={c.label} className="panel flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${c.tone}`}>
                <c.Icon size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] text-[var(--color-muted)]">{c.label}</div>
                <div className="mt-1 h-4 w-16 animate-pulse rounded bg-white/[0.1]" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-1.5 md:gap-3 lg:grid-cols-2">
          <div className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
            <h3 className="mb-3 text-sm font-semibold">Stake Details</h3>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.05]" />
              </div>
            </div>
          </div>
          <div className="panel space-y-2 rounded-md p-1 md:rounded-xl md:p-3">
            <h3 className="text-sm font-semibold">Agent Settings</h3>
            {["Max Budget per Job", "Max Expiry Duration", "Status", "Offline Mode"].map((label) => (
              <div
                key={label}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] py-2 last:border-0"
              >
                <span className="text-xs text-[var(--color-muted)]">{label}</span>
                <span className="h-3.5 w-14 animate-pulse rounded bg-white/[0.1]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
      <div className="text-base font-bold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

function StakeMetrics({
  stake,
  settledVol,
  available,
  pendingSlashAmt,
}: {
  stake: bigint;
  settledVol: bigint;
  available: bigint;
  pendingSlashAmt: bigint;
}) {
  const values = [
    `${formatUsdc(stake)} USDC`,
    `${formatUsdc(settledVol)} USDC`,
    `${formatUsdc(available)} USDC`,
    `${formatUsdc(pendingSlashAmt)} USDC`,
  ];
  return (
    <div className="mb-2 grid grid-cols-2 gap-1.5 md:mb-3 md:gap-2 xl:grid-cols-4">
      {STAKE_CARD_META.map((c, i) => (
        <StakeCard key={c.label} label={c.label} value={values[i]!} Icon={c.Icon} tone={c.tone} />
      ))}
    </div>
  );
}

function StakeDonut({
  title,
  stake,
  available,
  lockedAmt,
  availPct,
  lockedPct,
  locks = [],
}: {
  title: string;
  stake: bigint;
  available: bigint;
  lockedAmt: bigint;
  availPct: number;
  lockedPct: number;
  locks?: { jobId: bigint; amount: bigint; unlockAt?: number }[];
}) {
  const [page, setPage] = useState(0);
  const sorted = useMemo(
    () =>
      [...locks].sort((a, b) => (a.unlockAt ?? Number.MAX_SAFE_INTEGER) - (b.unlockAt ?? Number.MAX_SAFE_INTEGER)),
    [locks],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 3));
  const cur = Math.min(page, pages - 1);
  const slice = sorted.slice(cur * 3, cur * 3 + 3);

  return (
    <div className="panel rounded-md p-1 md:rounded-xl md:p-3.5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div
          className="relative mx-auto h-28 w-28 shrink-0 rounded-full sm:mx-0"
          style={{
            background:
              stake === 0n
                ? "var(--color-line)"
                : `conic-gradient(#22c55e 0% ${availPct}%, #8b5cf6 ${availPct}% 100%)`,
          }}
        >
          <div className="absolute inset-[22%] grid place-items-center rounded-full bg-[var(--color-panel)]">
            <div className="text-center">
              <div className="text-sm font-bold tabular-nums">{formatUsdc(stake)}</div>
              <div className="text-[9px] text-[var(--color-muted)]">USDC</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <ul className="space-y-2 text-xs">
            <LegendDot color="#22c55e" label="Available" value={`${formatUsdc(available)} · ${availPct.toFixed(1)}%`} />
            <LegendDot color="#8b5cf6" label="Locked" value={`${formatUsdc(lockedAmt)} · ${lockedPct.toFixed(1)}%`} />
            {slice.map((l) => (
              <li key={String(l.jobId)} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-[var(--color-text)]">
                  #{String(l.jobId)} · {formatUsdc(l.amount)} coverage
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                  {l.unlockAt ? formatExpiryAt(BigInt(l.unlockAt)) : "until resolve + 7d"}
                </span>
              </li>
            ))}
          </ul>
          {sorted.length > 3 && (
            <div className="mt-2 flex items-center justify-end gap-1">
              <button
                type="button"
                disabled={cur === 0}
                aria-label="Previous"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/15 text-[var(--color-muted)] disabled:opacity-35"
                onClick={() => setPage(cur - 1)}
              >
                &lt;
              </button>
              <button
                type="button"
                disabled={cur >= pages - 1}
                aria-label="Next"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/15 text-[var(--color-muted)] disabled:opacity-35"
                onClick={() => setPage(cur + 1)}
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StakeCard({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  Icon: typeof IconCoin;
  tone: string;
}) {
  return (
    <div className="panel flex items-center gap-3 rounded-xl px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
        <div className="truncate text-sm font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-[var(--color-muted)]">{value}</span>
    </li>
  );
}

function SettingsRow({
  label,
  value,
  onEdit,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  Icon?: typeof IconCoin;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] py-2 text-xs last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone ?? "bg-white/10 text-[var(--color-muted)]"}`}>
            <Icon size={14} />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[var(--color-muted)]">{label}</div>
          <div className="font-medium leading-tight">{value}</div>
        </div>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="ghost-btn rounded-md px-2 py-1 text-[10px]">
          Edit
        </button>
      )}
    </div>
  );
}

function SettingBlock({
  Icon,
  tone,
  title,
  hint,
  trailing,
  children,
}: {
  Icon: typeof IconCoin;
  tone: string;
  title: string;
  hint: string;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-[var(--color-line)] pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium">{title}</div>
            <div className="text-[10px] text-[var(--color-muted)]">{hint}</div>
          </div>
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function ActiveJobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3.5 py-2.5">
        <h3 className="text-sm font-semibold">Active Jobs ({jobs.length})</h3>
        <Link to="/jobs" className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          View all
        </Link>
      </div>
      {jobs.length === 0 ? (
        <Empty>No active jobs.</Empty>
      ) : (
        <JobsTable jobs={jobs} />
      )}
    </div>
  );
}

function JobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          <tr className="border-b border-[var(--color-line)]">
            <th className="px-3.5 py-2.5 font-medium">Job</th>
            <th className="px-2 py-2.5 font-medium">Title</th>
            <th className="px-2 py-2.5 font-medium">
              <span className="inline-flex items-center gap-1">
                <IconUser size={10} className="text-[var(--color-blue)]" /> Client
              </span>
            </th>
            <th className="px-2 py-2.5 font-medium">
              <span className="inline-flex items-center gap-1">
                <IconCoin size={10} className="text-[var(--color-accent)]" /> Budget
              </span>
            </th>
            <th className="px-2 py-2.5 font-medium">Status</th>
            <th className="px-3.5 py-2.5 font-medium">
              <span className="inline-flex items-center gap-1">
                <IconClock size={10} /> Expiry
              </span>
            </th>
            <th className="px-2 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const { Icon, tone } = JOB_STATUS_VISUAL[j.status];
            return (
              <tr
                key={String(j.id)}
                className="border-b border-[var(--color-line)]/70 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-3.5 py-2.5">
                  <Link
                    to={`/jobs/${j.id}`}
                    className="inline-flex items-center gap-2 font-medium text-[var(--color-accent)] hover:underline"
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-md border border-white/10 ${tone}`}>
                      <Icon size={12} />
                    </span>
                    #{String(j.id)}
                  </Link>
                </td>
                <td className="max-w-[200px] truncate px-2 py-2.5">{jobTitle(j.title, j.description)}</td>
                <td className="px-2 py-2.5 font-mono text-[11px]">{shortAddr(j.client, 4)}</td>
                <td className="px-2 py-2.5 tabular-nums">{formatUsdc(j.budget)} USDC</td>
                <td className="px-2 py-2.5">
                  <StatusBadge status={j.status} />
                </td>
                <td className="px-3.5 py-2.5 text-[var(--color-muted)]">{timeLeft(j.expiredAt)}</td>
                <td className="px-2 py-2.5">
                  <Link to={`/jobs/${j.id}`} className="text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                    <IconArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RatingRow({
  jobId,
  scoreTenths,
  at,
  title,
  compact,
}: {
  jobId: bigint;
  scoreTenths: number;
  at: number;
  title?: string;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Number(scoreTenths)));
  return (
    <li>
      <Link
        to={`/jobs/${jobId}`}
        className={`panel flex items-center gap-3 rounded-xl transition hover:bg-white/[0.03] ${
          compact ? "px-3 py-2.5" : "px-3.5 py-3.5"
        }`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-[var(--color-orange)]">
          <IconStar size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {title || `Job #${String(jobId)}`}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--color-muted)]">
            <span className="font-mono">#{String(jobId)}</span>
            <span>·</span>
            <span>{relativeTime(at)}</span>
          </div>
          {!compact && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-[var(--color-orange)]/80"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-[var(--color-orange)]">
            {formatScore(scoreTenths)}
            <span className="text-[11px] font-medium text-[var(--color-muted)]">/10</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">{children}</div>;
}
