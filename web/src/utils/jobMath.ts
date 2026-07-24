import { zeroAddress } from "viem";
import { JobStatus } from "@/types/job";
import { BOND_BP, CANCEL_FEE_BP, EVALUATOR_FEE_BP, RESOLVE_WINDOW_SEC } from "@/config/contracts";

export function bondOf(budget: bigint) {
  return (budget * BigInt(BOND_BP)) / 10_000n;
}

export function feeOf(budget: bigint) {
  return (budget * BigInt(EVALUATOR_FEE_BP)) / 10_000n;
}

export function cancelFeeOf(budget: bigint, fromStatus: JobStatus) {
  if (fromStatus !== JobStatus.Open) return 0n;
  return (budget * BigInt(CANCEL_FEE_BP)) / 10_000n;
}

export function canClaimRefund(
  job: { status: JobStatus; expiredAt: bigint; submittedAt: bigint },
  nowSec = Date.now() / 1000,
) {
  const s = job.status;
  if (
    s !== JobStatus.Posted &&
    s !== JobStatus.AgentPending &&
    s !== JobStatus.Open &&
    s !== JobStatus.Claimed &&
    s !== JobStatus.Submitted
  ) {
    return false;
  }
  if (s === JobStatus.Submitted) {
    return job.submittedAt > 0n && nowSec >= Number(job.submittedAt) + RESOLVE_WINDOW_SEC;
  }
  return nowSec >= Number(job.expiredAt);
}

export function canClaimJob(
  job: { status: JobStatus; client: string; agentId: bigint },
  address?: string,
  myAgentIds?: Set<string>,
) {
  if (!address || job.status !== JobStatus.Open) return false;
  const a = address.toLowerCase();
  if (job.client.toLowerCase() === a) return false;
  if (job.agentId > 0n && myAgentIds?.has(job.agentId.toString())) return false;
  return true;
}

export function isZero(addr?: string) {
  return !addr || addr.toLowerCase() === zeroAddress;
}

type StepState = "done" | "current" | "missed" | "todo";

export type TimelinePath = {
  agentId?: bigint;
  provider?: string;
  cancelFee?: bigint;
  submittedAt?: bigint;
  hadApply?: boolean;
};

function reached(status: JobStatus, path?: TimelinePath): number {
  switch (status) {
    case JobStatus.Posted:
      return 0;
    case JobStatus.AgentPending:
      return 1;
    case JobStatus.Open:
      return 2;
    case JobStatus.Claimed:
      return 3;
    case JobStatus.Submitted:
      return 4;
    case JobStatus.Completed:
    case JobStatus.Rejected:
      return 5;
    case JobStatus.Expired:
    case JobStatus.Cancelled: {
      if (path?.submittedAt && path.submittedAt > 0n) return 4;
      if (path?.provider && !isZero(path.provider)) return 3;
      if (path?.cancelFee && path.cancelFee > 0n) return 2;
      if (path?.agentId && path.agentId > 0n) return 2;
      if (path?.hadApply) return 1;
      return 0;
    }
    default:
      return 0;
  }
}

export function jobTimeline(status: JobStatus, rated = false, path?: TimelinePath) {
  const steps: { key: string; label: string; need: number }[] = [
    { key: "posted", label: "Posted", need: 0 },
    { key: "applied", label: "Agent applied", need: 1 },
    { key: "approved", label: "Client approved", need: 2 },
    { key: "claimed", label: "Provider claimed", need: 3 },
    { key: "submitted", label: "Work submitted", need: 4 },
    { key: "resolved", label: "Completed", need: 5 },
    { key: "rated", label: "Rated", need: 6 },
  ];

  const terminal =
    status === JobStatus.Rejected
      ? "Rejected"
      : status === JobStatus.Expired
        ? "Expired"
        : status === JobStatus.Cancelled
          ? "Cancelled"
          : null;

  const dead =
    status === JobStatus.Cancelled ||
    status === JobStatus.Rejected ||
    status === JobStatus.Expired;
  const max = reached(status, path);
  const active = !dead && status !== JobStatus.Completed;

  return steps.map((s) => {
    let state: StepState = "todo";
    let label = s.label;

    if (s.key === "resolved") {
      if (terminal) {
        label = terminal;
        state = "done";
      } else if (status === JobStatus.Completed) {
        state = "done";
      } else if (max < 5) {
        state = dead ? "missed" : active && s.need === max + 1 ? "current" : "todo";
      }
      return { ...s, label, state, terminalLabel: terminal || "Completed" };
    }

    if (s.key === "rated") {
      if (rated) state = "done";
      else if (status === JobStatus.Completed && !rated) state = "current";
      else if (dead) state = "missed";
      else state = "todo";
      return { ...s, label, state, terminalLabel: terminal || "Completed" };
    }

    if (s.need <= max) state = "done";
    else if (active && s.need === max + 1) state = "current";
    else state = dead ? "missed" : "todo";

    return { ...s, label, state, terminalLabel: terminal || "Completed" };
  });
}
