import { Link } from "react-router-dom";
import type { IndexedAgent } from "@/libs/arcscan";
import { RobotIcon } from "@/components/agents/RobotIcon";
import { formatScore, formatUsdc, shortAddr } from "@/utils/format";

export function AgentCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <article className="panel flex flex-col rounded-xl px-3 py-3 md:p-4" aria-hidden>
      <div className="mb-2 flex items-start justify-between gap-2 md:mb-3">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <span
            className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/[0.08] md:h-11 md:w-11"
            style={{ animationDelay: `${delay}ms` }}
          />
          <div className="min-w-0 space-y-1.5">
            <div className="h-3.5 w-28 animate-pulse rounded bg-white/[0.1]" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <span className="h-5 w-14 animate-pulse rounded-md bg-white/[0.06]" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-white/[0.05]" />
        ))}
      </div>
      <div className="mt-auto h-8 w-full animate-pulse rounded-lg bg-white/[0.06] md:ml-auto md:w-24" />
    </article>
  );
}

export function AgentCard({ agent }: { agent: IndexedAgent }) {
  const title = agent.name || `Agent #${String(agent.id)}`;
  const blurb = agent.description || "SettleNet evaluator · ERC-8004 identity";
  const score = formatScore(agent.scoreTenths);
  const status = agent.retired
    ? "Retired"
    : agent.pendingSlash
      ? "Pending slash"
      : agent.active
        ? "Active"
        : agent.offline
          ? "Offline"
          : "Inactive";
  const statusTone = agent.active
    ? "bg-emerald-500/15 text-[var(--color-accent)]"
    : agent.pendingSlash
      ? "bg-red-500/15 text-red-300"
      : agent.offline
        ? "bg-amber-500/15 text-[var(--color-orange)]"
        : "bg-white/8 text-[var(--color-muted)]";

  return (
    <article className="panel flex flex-col rounded-xl px-3 py-3 md:p-4">
      <div className="mb-2 flex items-start justify-between gap-2 md:mb-3">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <RobotIcon seed={agent.id} size={36} className="md:hidden" />
          <span className="hidden md:block">
            <RobotIcon seed={agent.id} size={44} />
          </span>
          <div className="min-w-0">
            <Link
              to={`/agents/${agent.id}`}
              className="block truncate text-sm font-semibold hover:text-[var(--color-accent)] md:text-base"
            >
              {title}
            </Link>
            <div className="text-[11px] text-[var(--color-muted)] md:text-xs">
              #{String(agent.id)} · {shortAddr(agent.owner, 4)}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase md:px-2 md:text-[10px] ${statusTone}`}
        >
          {status}
        </span>
      </div>

      <p className="mb-2.5 line-clamp-2 text-xs leading-snug text-[var(--color-muted)] md:mb-4 md:text-sm">
        {blurb}
      </p>

      <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] md:mb-4 md:grid-cols-4 md:gap-2 md:text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Rating</div>
          <div className="font-semibold tabular-nums">{score}/10</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Stake</div>
          <div className="font-semibold tabular-nums">{formatUsdc(agent.stake)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Jobs</div>
          <div className="font-semibold tabular-nums">{agent.jobCount}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Settled</div>
          <div className="font-semibold tabular-nums">{formatUsdc(agent.settledVol)}</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] md:mb-4 md:gap-2 md:text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Max budget</div>
          <div className="font-semibold tabular-nums">
            {agent.maxBudget ? `${formatUsdc(agent.maxBudget)} USDC` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Max expiry</div>
          <div className="font-semibold tabular-nums">
            {agent.maxExpiry ? `${Number(agent.maxExpiry) / 86400}d` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <Link
          to={`/agents/${agent.id}`}
          className="flex w-full items-center justify-center rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-[var(--color-accent)] hover:bg-emerald-500/30 md:ml-auto md:inline-flex md:w-auto md:px-3 md:py-1.5 md:text-sm"
        >
          View Agent
        </Link>
      </div>
    </article>
  );
}
