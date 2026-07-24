import { useMemo, type ComponentType } from "react";
import { asBig, formatScore, formatUsdc } from "@/utils/format";
import { useIndexedState } from "@/hooks/useIndexedState";
import type { DecodedLog } from "@/libs/arcscan";
import {
  IconArrowUp,
  IconBriefcase,
  IconCheckCircle,
  IconDoc,
  IconLock,
  IconPlus,
  IconStar,
  IconUser,
  IconX,
} from "@/components/ui/Icons";

type ActivityItem = {
  id: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
  title: string;
  detail: string;
  at: number;
  href?: string;
};

function toneIcon(name: string): {
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
} {
  switch (name) {
    case "JobCompleted":
      return { Icon: IconCheckCircle, tone: "bg-emerald-500/15 text-[var(--color-accent)]" };
    case "EvaluatorRated":
      return { Icon: IconStar, tone: "bg-amber-500/15 text-[var(--color-orange)]" };
    case "JobClaimed":
      return { Icon: IconLock, tone: "bg-amber-500/15 text-[var(--color-orange)]" };
    case "JobSubmitted":
      return { Icon: IconArrowUp, tone: "bg-teal-500/15 text-[var(--color-cyan)]" };
    case "AgentApplied":
      return { Icon: IconUser, tone: "bg-violet-500/15 text-[var(--color-violet)]" };
    case "AgentApproved":
      return { Icon: IconCheckCircle, tone: "bg-emerald-500/15 text-[var(--color-accent)]" };
    case "AgentRejected":
      return { Icon: IconX, tone: "bg-red-500/15 text-red-300" };
    case "JobCreated":
      return { Icon: IconPlus, tone: "bg-blue-500/15 text-[var(--color-blue)]" };
    case "JobCancelled":
      return { Icon: IconX, tone: "bg-white/8 text-[var(--color-muted)]" };
    case "JobExpired":
      return { Icon: IconBriefcase, tone: "bg-white/8 text-[var(--color-muted)]" };
    case "JobRejected":
      return { Icon: IconX, tone: "bg-red-500/15 text-red-300" };
    default:
      return { Icon: IconDoc, tone: "bg-white/8 text-[var(--color-muted)]" };
  }
}

function describe(ev: DecodedLog): { title: string; detail: string; href?: string } {
  const jobId = ev.args.jobId != null ? String(ev.args.jobId) : undefined;
  const href = jobId ? `/jobs/${jobId}` : undefined;

  switch (ev.eventName) {
    case "JobCreated":
      return {
        title: "New job created",
        detail: `Job #${jobId} · ${formatUsdc(asBig(ev.args.budget))} USDC`,
        href,
      };
    case "AgentApplied":
      return { title: `Agent #${ev.args.agentId} applied`, detail: `Job #${jobId}`, href };
    case "AgentApproved":
      return { title: `Agent #${ev.args.agentId} approved`, detail: `Job #${jobId}`, href };
    case "AgentRejected":
      return { title: `Agent #${ev.args.agentId} rejected`, detail: `Job #${jobId}`, href };
    case "JobClaimed":
      return {
        title: `Job #${jobId} claimed`,
        detail: `Bond ${formatUsdc(asBig(ev.args.bond))} USDC`,
        href,
      };
    case "JobSubmitted":
      return { title: `Submission on Job #${jobId}`, detail: "Work submitted", href };
    case "JobCompleted":
      return {
        title: `Job #${jobId} completed`,
        detail: `Paid ${formatUsdc(asBig(ev.args.paid))} · fee ${formatUsdc(asBig(ev.args.evaluatorFee))}`,
        href,
      };
    case "JobRejected":
      return {
        title: `Job #${jobId} rejected`,
        detail: `Refund ${formatUsdc(asBig(ev.args.refund))} USDC`,
        href,
      };
    case "JobExpired":
      return { title: `Job #${jobId} expired`, detail: "Refund / ghost path", href };
    case "JobCancelled":
      return {
        title: `Job #${jobId} cancelled`,
        detail:
          asBig(ev.args.evaluatorFee ?? 0) > 0n
            ? `Cancel fee ${formatUsdc(asBig(ev.args.evaluatorFee))} USDC`
            : "Full refund",
        href,
      };
    case "EvaluatorRated":
      return {
        title: `Agent #${ev.args.agentId} rated ${formatScore(ev.args.scoreTenths as number | bigint)}/10`,
        detail: `Job #${jobId}`,
        href,
      };
    default:
      return { title: ev.eventName, detail: jobId ? `Job #${jobId}` : "", href };
  }
}

export function useSettleNetActivity(limit?: number) {
  const { data, isLoading, isFetched, error } = useIndexedState();

  const items = useMemo(() => {
    if (!data) return [] as ActivityItem[];
    const sorted = [...data.settleLogs].sort((a, b) => b.at - a.at || b.logIndex - a.logIndex);
    const slice = limit == null ? sorted : sorted.slice(0, limit);
    return slice.map((ev) => {
      const { Icon, tone } = toneIcon(ev.eventName);
      const { title, detail, href } = describe(ev);
      return {
        id: `${ev.txHash}-${ev.logIndex}`,
        Icon,
        tone,
        title,
        detail,
        href,
        at: ev.at,
      };
    });
  }, [data, limit]);

  return { data: items, isLoading: isLoading && !isFetched, error };
}

export function useAgentRatings(agentId?: bigint, limit = 10) {
  const { data, isLoading } = useIndexedState();

  const ratings = useMemo(() => {
    if (agentId === undefined || agentId <= 0n || !data) return [];
    return data.settleLogs
      .filter(
        (e) =>
          e.eventName === "EvaluatorRated" &&
          e.args.agentId != null &&
          BigInt(e.args.agentId as bigint | string | number) === agentId,
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, limit)
      .map((e) => ({
        jobId: BigInt(e.args.jobId as bigint | string | number),
        scoreTenths: Number(e.args.scoreTenths),
        at: e.at,
        tx: e.txHash,
      }));
  }, [data, agentId, limit]);

  return { data: ratings, isLoading: isLoading && agentId !== undefined && agentId > 0n };
}
