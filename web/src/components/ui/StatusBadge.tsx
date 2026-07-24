import type { ComponentType } from "react";
import { JobStatus, STATUS_LABEL } from "@/types/job";
import {
  IconBolt,
  IconCheckCircle,
  IconClock,
  IconDoc,
  IconLock,
  IconPlus,
  IconRobotHead,
  IconX,
} from "@/components/ui/Icons";

type IconComp = ComponentType<{ size?: number; className?: string }>;

export const JOB_STATUS_VISUAL: Record<
  JobStatus,
  { Icon: IconComp; tone: string; chip: string; iconColor: string }
> = {
  [JobStatus.Posted]: {
    Icon: IconPlus,
    tone: "bg-blue-500/20 text-[var(--color-blue)]",
    chip: "bg-blue-500/15 text-[var(--color-blue)]",
    iconColor: "text-[var(--color-blue)]",
  },
  [JobStatus.AgentPending]: {
    Icon: IconRobotHead,
    tone: "bg-[var(--color-violet)]/20 text-[var(--color-violet)]",
    chip: "bg-[var(--color-violet)]/15 text-[var(--color-violet)]",
    iconColor: "text-[var(--color-violet)]",
  },
  [JobStatus.Open]: {
    Icon: IconBolt,
    tone: "bg-emerald-500/20 text-[var(--color-accent)]",
    chip: "bg-emerald-500/15 text-[var(--color-accent)]",
    iconColor: "text-[var(--color-accent)]",
  },
  [JobStatus.Claimed]: {
    Icon: IconLock,
    tone: "bg-amber-500/20 text-[var(--color-orange)]",
    chip: "bg-amber-500/15 text-[var(--color-orange)]",
    iconColor: "text-[var(--color-orange)]",
  },
  [JobStatus.Submitted]: {
    Icon: IconDoc,
    tone: "bg-teal-500/20 text-[var(--color-cyan)]",
    chip: "bg-teal-500/15 text-[var(--color-cyan)]",
    iconColor: "text-[var(--color-cyan)]",
  },
  [JobStatus.Completed]: {
    Icon: IconCheckCircle,
    tone: "bg-emerald-500/20 text-[var(--color-accent)]",
    chip: "bg-emerald-500/15 text-[var(--color-accent)]",
    iconColor: "text-[var(--color-accent)]",
  },
  [JobStatus.Rejected]: {
    Icon: IconX,
    tone: "bg-red-500/20 text-red-300",
    chip: "bg-red-500/15 text-red-300",
    iconColor: "text-red-300",
  },
  [JobStatus.Expired]: {
    Icon: IconClock,
    tone: "bg-white/12 text-[var(--color-muted)]",
    chip: "bg-white/8 text-[var(--color-muted)]",
    iconColor: "text-[var(--color-muted)]",
  },
  [JobStatus.Cancelled]: {
    Icon: IconX,
    tone: "bg-red-500/15 text-red-300/80",
    chip: "bg-red-500/12 text-red-300/80",
    iconColor: "text-red-300/80",
  },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const { Icon, chip } = JOB_STATUS_VISUAL[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide md:px-2 md:text-[10px] ${chip}`}
    >
      <Icon size={10} />
      {STATUS_LABEL[status]}
    </span>
  );
}
