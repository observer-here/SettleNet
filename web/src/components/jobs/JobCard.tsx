import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Job } from "@/types/job";
import { JobStatus } from "@/types/job";
import { JOB_STATUS_VISUAL, StatusBadge } from "@/components/ui/StatusBadge";
import {
  IconArrowRight,
  IconBriefcase,
  IconClock,
  IconCoin,
  IconLock,
  IconRobotHead,
  IconStar,
  IconUser,
  IconWallet,
} from "@/components/ui/Icons";
import { BOND_BP, EVALUATOR_FEE_BP } from "@/config/contracts";
import { formatExpiryAt, formatUsdc, jobTitle, shortAddr, timeLeft } from "@/utils/format";
import { bondOf, feeOf, isZero } from "@/utils/jobMath";
import { linkifyText } from "@/utils/linkify";

type Props = {
  job: Job;
  agentScore?: number;
  onAction?: () => void;
  actionPending?: boolean;
  showClaim?: boolean;
};

function JobCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <article className="panel rounded-xl px-3 py-3 md:px-5 md:py-[1.125rem]" aria-hidden>
      <div className="flex items-start gap-3 md:gap-4">
        <span
          className="mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/[0.08] md:h-11 md:w-11"
          style={{ animationDelay: `${delay}ms` }}
        />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <div
            className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.1]"
            style={{ animationDelay: `${delay + 40}ms` }}
          />
          <div
            className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.06]"
            style={{ animationDelay: `${delay + 80}ms` }}
          />
        </div>
      </div>
    </article>
  );
}

export function JobListSkeleton({
  count = 5,
  className = "space-y-2 md:space-y-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} delay={i * 70} />
      ))}
    </div>
  );
}

export function JobCard({ job, agentScore, onAction, actionPending, showClaim }: Props) {
  const title = jobTitle(job.title, job.description);
  const blurb = job.description.trim();
  const canClaim = showClaim && job.status === JobStatus.Open;
  const bond = bondOf(job.budget);
  const fee = feeOf(job.budget);
  const { Icon, tone } = JOB_STATUS_VISUAL[job.status];
  const hasProvider = !isZero(job.provider);

  const action = canClaim && onAction ? (
    <button
      type="button"
      className="accent-btn inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs md:w-auto md:gap-1.5 md:px-3.5 md:text-sm"
      disabled={actionPending}
      onClick={onAction}
    >
      {actionPending ? "…" : "Claim"}
      {!actionPending && <IconArrowRight size={12} />}
    </button>
  ) : (
    <Link
      to={`/jobs/${job.id}`}
      className="ghost-btn inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs md:w-auto md:gap-1.5 md:px-3.5 md:text-sm"
    >
      View
      <IconArrowRight size={12} />
    </Link>
  );

  return (
    <article className="panel rounded-xl px-3 py-3 md:px-5 md:py-[1.125rem]">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 md:gap-4">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg md:h-11 md:w-11 ${tone}`}
          >
            <Icon size={16} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to={`/jobs/${job.id}`}
                className="min-w-0 max-w-full truncate text-sm font-semibold hover:text-[var(--color-accent)] md:text-[15px]"
              >
                {title}
              </Link>
              <span className="font-mono text-[11px] text-[var(--color-muted)]">#{String(job.id)}</span>
              <StatusBadge status={job.status} />
            </div>

            {blurb ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-[var(--color-muted)] md:text-sm">
                {linkifyText(blurb)}
              </p>
            ) : null}

            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] md:mt-3.5 md:flex md:flex-wrap md:gap-x-5 md:gap-y-2.5 md:text-[13px]">
              <Meta icon={<IconCoin size={12} />} tip="Budget" tone="text-[var(--color-accent)]">
                <span className="font-semibold tabular-nums">{formatUsdc(job.budget)}</span>
                <span className="text-[var(--color-muted)]"> USDC</span>
              </Meta>
              <Meta icon={<IconLock size={12} />} tip="Provider bond" tone="text-[var(--color-orange)]">
                <span className="font-semibold tabular-nums">{formatUsdc(bond)}</span>
                <span className="text-[var(--color-muted)]"> ({BOND_BP / 100}%)</span>
              </Meta>
              <Meta icon={<IconWallet size={12} />} tip="Evaluator fee" tone="text-[var(--color-cyan)]">
                <span className="font-semibold tabular-nums">{formatUsdc(fee)}</span>
                <span className="text-[var(--color-muted)]"> ({EVALUATOR_FEE_BP / 100}%)</span>
              </Meta>
              <Meta icon={<IconUser size={12} />} tip="Client" tone="text-[var(--color-blue)]">
                <span className="font-mono">{shortAddr(job.client, 4)}</span>
              </Meta>
              <Meta icon={<IconRobotHead size={12} />} tip="Evaluator" tone="text-[var(--color-violet)]">
                {job.agentId > 0n ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Link to={`/agents/${job.agentId}`} className="truncate hover:text-[var(--color-accent)]">
                      Agent #{String(job.agentId)}
                    </Link>
                    {agentScore != null && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[var(--color-orange)]">
                        <IconStar size={11} />
                        {agentScore.toFixed(1)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[var(--color-muted)]">Unassigned</span>
                )}
              </Meta>
              {hasProvider && (
                <Meta icon={<IconBriefcase size={12} />} tip="Provider" tone="text-[var(--color-orange)]">
                  <span className="font-mono">{shortAddr(job.provider, 4)}</span>
                </Meta>
              )}
              <Meta icon={<IconClock size={12} />} tip="Expiry" tone="text-[var(--color-muted)]">
                <span className="font-medium">{timeLeft(job.expiredAt)}</span>
                <span className="hidden text-[var(--color-muted)] md:inline">
                  {" "}
                  · {formatExpiryAt(job.expiredAt)}
                </span>
              </Meta>
            </div>
          </div>
        </div>

        <div className="shrink-0 md:self-center">{action}</div>
      </div>
    </article>
  );
}

function Meta({
  icon,
  tip,
  tone = "text-[var(--color-muted)]",
  children,
}: {
  icon: ReactNode;
  tip: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <span title={tip} className="inline-flex min-w-0 items-center gap-1 text-[var(--color-text)] md:gap-1.5">
      <span className={`shrink-0 ${tone}`}>{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
