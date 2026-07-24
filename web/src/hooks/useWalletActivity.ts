import { useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { addresses } from "@/config/contracts";
import {
  fetchIdentityTransfers,
  type DecodedLog,
  type IndexedAgent,
  type IndexedJob,
} from "@/libs/arcscan";
import { useIndexedState } from "@/hooks/useIndexedState";
import { asBig, formatScore, formatUsdc, shortAddr } from "@/utils/format";
import {
  IconArrowUp,
  IconBriefcase,
  IconCoin,
  IconDoc,
  IconLock,
  IconPlus,
  IconRobotHead,
  IconSend,
  IconShield,
  IconStar,
  IconUser,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/ui/Icons";

export type ActivityKind = "jobs" | "agents" | "staking" | "ratings";
export type ActivityStatus = "success" | "rejected" | "info";

export type WalletActivityItem = {
  id: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
  title: string;
  detail: string;
  at: number;
  href?: string;
  tx: string;
  kind: ActivityKind;
  status: ActivityStatus;
  eventName: string;
  paid?: bigint;
};

function kindOf(name: string): ActivityKind {
  if (name === "EvaluatorRated") return "ratings";
  if (
    name === "AgentStaked" ||
    name === "Withdrawn" ||
    name === "Slashed" ||
    name === "PendingSlash"
  )
    return "staking";
  if (
    name === "Transfer" ||
    name === "OfflineSet" ||
    name === "MaxBudgetSet" ||
    name === "MaxExpirySet"
  )
    return "agents";
  return "jobs";
}

function statusOf(name: string): ActivityStatus {
  if (name === "JobRejected" || name === "AgentRejected") return "rejected";
  if (
    name === "JobCompleted" ||
    name === "AgentApproved" ||
    name === "AgentStaked" ||
    name === "Transfer" ||
    name === "EvaluatorRated"
  )
    return "success";
  return "info";
}

function eq(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function agentOwner(agents: IndexedAgent[], agentId: unknown): string | undefined {
  if (agentId == null) return undefined;
  return agents.find((a) => a.id === asBig(agentId))?.owner;
}

function jobOf(jobs: IndexedJob[], jobId: unknown): IndexedJob | undefined {
  if (jobId == null) return undefined;
  return jobs.find((j) => j.id === asBig(jobId));
}

function settleInvolves(
  ev: DecodedLog,
  wallet: Address,
  agents: IndexedAgent[],
  jobs: IndexedJob[],
): boolean {
  const w = wallet.toLowerCase();
  const args = ev.args;
  switch (ev.eventName) {
    case "JobCreated":
      return eq(String(args.client), w);
    case "AgentApplied":
      return eq(String(args.owner_), w);
    case "JobClaimed":
      return eq(String(args.provider), w);
    case "AgentApproved":
    case "AgentRejected":
    case "EvaluatorRated":
      return eq(agentOwner(agents, args.agentId), w) || eq(jobOf(jobs, args.jobId)?.client, w);
    case "JobSubmitted":
    case "JobCompleted":
    case "JobRejected":
    case "JobExpired":
    case "JobCancelled": {
      const j = jobOf(jobs, args.jobId);
      if (!j) return false;
      return eq(j.client, w) || eq(j.provider, w) || eq(agentOwner(agents, j.agentId), w);
    }
    default:
      return false;
  }
}

function stakeInvolves(ev: DecodedLog, wallet: Address, agents: IndexedAgent[]): boolean {
  if (ev.args.owner_ != null) return eq(String(ev.args.owner_), wallet);
  return eq(agentOwner(agents, ev.args.agentId), wallet);
}

function describeSettle(
  ev: DecodedLog,
  scoped: boolean | "job" = false,
): { title: string; detail: string; href?: string } {
  const jobId = ev.args.jobId != null ? String(ev.args.jobId) : undefined;
  const jobScope = scoped === "job";
  const agentScope = scoped === true;
  const href = jobScope ? undefined : jobId ? `/jobs/${jobId}` : undefined;
  const agentId = ev.args.agentId != null ? String(ev.args.agentId) : "?";
  switch (ev.eventName) {
    case "JobCreated":
      return {
        title: jobScope ? "Created" : "Created a job",
        detail: jobScope
          ? `${formatUsdc(asBig(ev.args.budget))} USDC escrow`
          : `Job #${jobId} · ${formatUsdc(asBig(ev.args.budget))} USDC escrow`,
        href,
      };
    case "AgentApplied":
      return {
        title: jobScope ? "Agent applied" : agentScope ? "Applied to job" : `Applied with Agent #${agentId}`,
        detail: jobScope ? `Agent #${agentId}` : `Job #${jobId}`,
        href,
      };
    case "AgentApproved":
      return {
        title: jobScope ? "Agent approved" : agentScope ? "Approved for job" : `Agent #${agentId} approved`,
        detail: jobScope ? `Agent #${agentId}` : `Job #${jobId}`,
        href,
      };
    case "AgentRejected":
      return {
        title: jobScope ? "Agent rejected" : agentScope ? "Rejected for job" : `Agent #${agentId} rejected`,
        detail: jobScope ? `Agent #${agentId}` : `Job #${jobId}`,
        href,
      };
    case "JobClaimed":
      return {
        title: jobScope ? "Provider claimed" : `Claimed Job #${jobId}`,
        detail: `Bond ${formatUsdc(asBig(ev.args.bond))} USDC`,
        href,
      };
    case "JobSubmitted":
      return {
        title: jobScope ? "Work submitted" : `Submitted work on Job #${jobId}`,
        detail: "Deliverable posted",
        href,
      };
    case "JobCompleted":
      return {
        title: jobScope ? "Completed" : `Job #${jobId} completed`,
        detail: `Paid ${formatUsdc(asBig(ev.args.paid))} · fee ${formatUsdc(asBig(ev.args.evaluatorFee))}`,
        href,
      };
    case "JobRejected":
      return {
        title: jobScope ? "Rejected" : `Job #${jobId} rejected`,
        detail: `Refund ${formatUsdc(asBig(ev.args.refund))} USDC`,
        href,
      };
    case "JobCancelled": {
      const cFee = asBig(ev.args.evaluatorFee ?? 0);
      return {
        title: jobScope ? "Cancelled" : `Cancelled Job #${jobId}`,
        detail: cFee > 0n ? `Cancel fee ${formatUsdc(cFee)} USDC` : "Full refund to client",
        href,
      };
    }
    case "JobExpired":
      return {
        title: jobScope ? "Expired" : `Job #${jobId} expired`,
        detail: "Refund / ghost path",
        href,
      };
    case "EvaluatorRated":
      return {
        title: jobScope ? "Evaluator rated" : agentScope ? "Received rating" : `Rated Agent #${agentId}`,
        detail: jobScope
          ? `${formatScore(ev.args.scoreTenths as number | bigint)}/10 · Agent #${agentId}`
          : `${formatScore(ev.args.scoreTenths as number | bigint)}/10 · Job #${jobId}`,
        href,
      };
    default:
      return { title: ev.eventName, detail: jobScope ? "" : jobId ? `Job #${jobId}` : "", href };
  }
}

function describeStake(ev: DecodedLog, scoped = false): { title: string; detail: string; href?: string } {
  const agentId = ev.args.agentId != null ? String(ev.args.agentId) : "?";
  const href = scoped || ev.args.agentId == null ? undefined : `/agents/${agentId}`;
  switch (ev.eventName) {
    case "AgentStaked":
      return {
        title: scoped ? "Stake added" : `Staked on Agent #${agentId}`,
        detail: `Total stake ${formatUsdc(asBig(ev.args.total))} USDC`,
        href,
      };
    case "Withdrawn":
      return {
        title: scoped ? "Stake withdrawn" : `Withdrew from Agent #${agentId}`,
        detail: `${formatUsdc(asBig(ev.args.amount))} USDC`,
        href,
      };
    case "MaxBudgetSet":
      return {
        title: scoped ? "Max budget set" : `Set max budget · Agent #${agentId}`,
        detail: `${formatUsdc(asBig(ev.args.budget))} USDC`,
        href,
      };
    case "MaxExpirySet":
      return {
        title: scoped ? "Max expiry set" : `Set max expiry · Agent #${agentId}`,
        detail: `${Number(asBig(ev.args.duration)) / 86400} days`,
        href,
      };
    case "OfflineSet":
      return {
        title: Boolean(ev.args.offline)
          ? scoped
            ? "Went offline"
            : `Went offline · Agent #${agentId}`
          : scoped
            ? "Went online"
            : `Went online · Agent #${agentId}`,
        detail: "Availability updated",
        href,
      };
    case "Slashed":
      return {
        title: scoped ? "Slashed" : `Agent #${agentId} slashed`,
        detail: `${formatUsdc(asBig(ev.args.amount))} USDC`,
        href,
      };
    case "PendingSlash":
      return {
        title: scoped ? "Pending slash" : `Pending slash · Agent #${agentId}`,
        detail: `${formatUsdc(asBig(ev.args.amount))} USDC`,
        href,
      };
    default:
      return { title: ev.eventName, detail: scoped ? "" : `Agent #${agentId}`, href };
  }
}

function toneFor(name: string): {
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
} {
  switch (name) {
    case "JobCreated":
      return { Icon: IconPlus, tone: "bg-blue-500/20 text-[var(--color-blue)]" };
    case "Transfer":
      return { Icon: IconRobotHead, tone: "bg-violet-500/20 text-[var(--color-violet)]" };
    case "AgentStaked":
      return { Icon: IconArrowUp, tone: "bg-emerald-500/20 text-[var(--color-accent)]" };
    case "Withdrawn":
      return { Icon: IconCoin, tone: "bg-amber-500/20 text-[var(--color-orange)]" };
    case "AgentApplied":
      return { Icon: IconSend, tone: "bg-blue-500/20 text-[var(--color-blue)]" };
    case "AgentApproved":
      return { Icon: IconUser, tone: "bg-amber-500/20 text-[var(--color-orange)]" };
    case "JobClaimed":
      return { Icon: IconBriefcase, tone: "bg-indigo-500/20 text-indigo-300" };
    case "JobSubmitted":
      return { Icon: IconDoc, tone: "bg-teal-500/20 text-[var(--color-cyan)]" };
    case "JobCompleted":
      return { Icon: IconWallet, tone: "bg-emerald-500/20 text-[var(--color-accent)]" };
    case "EvaluatorRated":
      return { Icon: IconStar, tone: "bg-amber-500/20 text-[var(--color-orange)]" };
    case "AgentRejected":
    case "JobRejected":
    case "JobCancelled":
      return { Icon: IconX, tone: "bg-red-500/20 text-red-300" };
    case "JobExpired":
    case "Slashed":
    case "PendingSlash":
      return { Icon: IconShield, tone: "bg-red-500/15 text-red-300" };
    case "OfflineSet":
    case "MaxBudgetSet":
    case "MaxExpirySet":
      return { Icon: IconUsers, tone: "bg-white/10 text-[var(--color-muted)]" };
    default:
      return { Icon: IconLock, tone: "bg-white/10 text-[var(--color-muted)]" };
  }
}

function describeIdentity(
  ev: DecodedLog,
  scoped = false,
  wallet?: Address,
): { title: string; detail: string; href?: string } {
  const tokenId = ev.args.tokenId != null ? String(ev.args.tokenId) : "?";
  const from = String(ev.args.from ?? "");
  const to = String(ev.args.to ?? "");
  const href = tokenId !== "?" ? `/agents/${tokenId}` : undefined;
  const mint = from.toLowerCase() === zeroAddress;

  if (mint) {
    return {
      title: scoped ? "Minted" : "Agent NFT minted",
      detail: scoped ? "ERC-8004 identity created" : `You minted Agent #${tokenId}`,
      href,
    };
  }

  if (wallet && eq(from, wallet)) {
    return {
      title: "Ownership transferred",
      detail: scoped
        ? `To ${shortAddr(to, 4)}`
        : `Agent #${tokenId} · to ${shortAddr(to, 4)}`,
      href,
    };
  }

  if (wallet && eq(to, wallet)) {
    return {
      title: scoped ? "Ownership transferred" : "Ownership received",
      detail: scoped
        ? `From ${shortAddr(from, 4)}`
        : `Agent #${tokenId} · from ${shortAddr(from, 4)}`,
      href,
    };
  }

  return {
    title: "Ownership transferred",
    detail: scoped
      ? `${shortAddr(from, 4)} → ${shortAddr(to, 4)}`
      : `Agent #${tokenId} · ${shortAddr(from, 4)} → ${shortAddr(to, 4)}`,
    href,
  };
}

export function toActivityItem(
  ev: DecodedLog,
  source: "settle" | "stake" | "identity",
  scoped: boolean | "job" = false,
  wallet?: Address,
): WalletActivityItem {
  const { Icon, tone } = toneFor(ev.eventName);
  const d =
    source === "identity"
      ? describeIdentity(ev, scoped === true, wallet)
      : source === "stake"
        ? describeStake(ev, scoped === true)
        : describeSettle(ev, scoped);
  return {
    id: `${ev.txHash}-${ev.logIndex}`,
    Icon,
    tone,
    title: d.title,
    detail: d.detail,
    href: d.href,
    at: ev.at,
    tx: ev.txHash,
    kind: kindOf(ev.eventName),
    status: statusOf(ev.eventName),
    eventName: ev.eventName,
  };
}

export const ACTIVITY_KIND_LINE: Record<ActivityKind, string> = {
  jobs: "border-l-[var(--color-blue)]",
  agents: "border-l-[var(--color-violet)]",
  staking: "border-l-[var(--color-accent)]",
  ratings: "border-l-[var(--color-orange)]",
};

export function useWalletActivity(limit = 120) {
  const { address, isConnected } = useAccount();
  const { data, isLoading: idxLoading, isFetched: idxFetched } = useIndexedState();

  const transfers = useQuery({
    queryKey: ["identity-transfers", "arcscan", addresses.identity, address],
    enabled: !!address,
    staleTime: 3 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchIdentityTransfers(address!),
  });

  const items = useMemo(() => {
    if (!address || !data) return [] as WalletActivityItem[];
    const out: WalletActivityItem[] = [];

    for (const ev of data.settleLogs) {
      if (!settleInvolves(ev, address, data.agents, data.jobs)) continue;
      const item = toActivityItem(ev, "settle");
      if (ev.eventName === "JobCompleted") {
        const j = jobOf(data.jobs, ev.args.jobId);
        if (j) {
          if (eq(j.provider, address)) item.paid = asBig(ev.args.paid);
          else if (eq(agentOwner(data.agents, j.agentId), address))
            item.paid = asBig(ev.args.evaluatorFee);
        }
      }
      out.push(item);
    }

    for (const ev of data.stakeLogs) {
      if (!stakeInvolves(ev, address, data.agents)) continue;
      out.push(toActivityItem(ev, "stake"));
    }

    for (const ev of transfers.data ?? []) {
      out.push(toActivityItem(ev, "identity", false, address));
    }

    return out.sort((a, b) => b.at - a.at).slice(0, limit);
  }, [address, data, transfers.data, limit]);

  const stats = useMemo(() => {
    if (!address || !data) {
      return {
        total: 0,
        jobsCompleted: 0,
        earned: 0n,
        avgRating: 0,
        ratingCount: 0,
        applied: 0,
        rejected: 0,
        staked: 0n,
        ownedAgentIds: [] as string[],
      };
    }
    const w = address.toLowerCase();
    const mine = data.agents.filter((a) => a.owner?.toLowerCase() === w);
    let jobsCompleted = 0;
    let earned = 0n;
    let applied = 0;
    let rejected = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const ev of data.settleLogs) {
      if (!settleInvolves(ev, address, data.agents, data.jobs)) continue;
      if (ev.eventName === "AgentApplied") applied++;
      if (ev.eventName === "JobRejected") rejected++;
      if (ev.eventName === "JobCompleted") {
        const j = jobOf(data.jobs, ev.args.jobId);
        if (!j) continue;
        const asProvider = eq(j.provider, address);
        const asAgent = eq(agentOwner(data.agents, j.agentId), address);
        if (asProvider || asAgent) jobsCompleted++;
        if (asProvider) earned += asBig(ev.args.paid);
        if (asAgent) earned += asBig(ev.args.evaluatorFee);
      }
      if (ev.eventName === "EvaluatorRated" && eq(agentOwner(data.agents, ev.args.agentId), address)) {
        ratingSum += Number(ev.args.scoreTenths) / 10;
        ratingCount++;
      }
    }

    return {
      total: items.length,
      jobsCompleted,
      earned,
      avgRating: ratingCount ? ratingSum / ratingCount : 0,
      ratingCount,
      applied,
      rejected,
      staked: mine.reduce((s, a) => s + a.stake, 0n),
      ownedAgentIds: mine.map((a) => a.id.toString()),
    };
  }, [address, data, items.length]);

  const earnings = useMemo(
    () =>
      items
        .filter((i) => i.eventName === "JobCompleted" && i.paid != null && i.paid > 0n)
        .slice(0, 5),
    [items],
  );

  return {
    data: items,
    stats,
    earnings,
    isLoading: isConnected && idxLoading && !idxFetched,
    address,
  };
}
