import { useEffect, useState, type ComponentType } from "react";
import { formatUnits } from "viem";
import { USDC_DECIMALS } from "@/config/contracts";
import {
  IconBolt,
  IconCoin,
  IconLock,
  IconShield,
  IconStar,
  IconX,
} from "@/components/ui/Icons";
import { JobStatus } from "@/types/job";

const palette: Record<string, string> = {
  Posted: "#3b82f6",
  "Agent Pending": "#8b5cf6",
  Open: "#22c55e",
  Claimed: "#f59e0b",
  Submitted: "#14b8a6",
  Completed: "#16a34a",
  Other: "#6b7280",
};

const primary = [
  JobStatus.Posted,
  JobStatus.AgentPending,
  JobStatus.Open,
  JobStatus.Claimed,
  JobStatus.Submitted,
  JobStatus.Completed,
] as const;

const labels: Record<(typeof primary)[number], string> = {
  [JobStatus.Posted]: "Posted",
  [JobStatus.AgentPending]: "Agent Pending",
  [JobStatus.Open]: "Open",
  [JobStatus.Claimed]: "Claimed",
  [JobStatus.Submitted]: "Submitted",
  [JobStatus.Completed]: "Completed",
};

function useCountUp(target: number, ms = 180) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function MechStat({
  label,
  target,
  usdc,
  Icon,
  tone,
  delay,
  className = "",
}: {
  label: string;
  target: number;
  usdc?: boolean;
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
  delay: number;
  className?: string;
}) {
  const shown = useCountUp(target);
  const value = usdc
    ? `${shown.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
    : String(Math.round(shown));

  return (
    <div
      className={`flex min-w-0 items-center gap-2 md:justify-center md:gap-2.5 ${className}`}
      style={{ animation: `statIn 0.25s ease ${Math.min(delay, 80)}ms both` }}
    >
      <span className={`icon-chip h-7 w-7 shrink-0 md:h-9 md:w-9 ${tone}`}>
        <Icon size={13} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10px] text-[var(--color-muted)]">{label}</div>
        <div className="truncate text-xs font-bold tabular-nums leading-tight md:text-sm">{value}</div>
      </div>
    </div>
  );
}

const MECH_META = [
  { label: "Bonds locked", Icon: IconLock, tone: "text-[var(--color-orange)] bg-amber-500/15", usdc: true },
  { label: "Fees settled", Icon: IconCoin, tone: "text-[var(--color-cyan)] bg-teal-500/15", usdc: true },
  { label: "Coverage", Icon: IconShield, tone: "text-[var(--color-violet)] bg-violet-500/15", usdc: true },
  { label: "In flight", Icon: IconBolt, tone: "text-[var(--color-blue)] bg-blue-500/15" },
  { label: "Awaiting rate", Icon: IconStar, tone: "text-[var(--color-accent)] bg-emerald-500/15" },
  { label: "At risk", Icon: IconX, tone: "text-red-300 bg-red-500/15" },
] as const;

function ChartSkeleton() {
  return (
    <section className="panel flex h-full flex-col rounded-xl p-3 md:rounded-2xl md:p-3.5">
      <h2 className="mb-3 shrink-0 text-sm font-semibold md:mb-4 md:text-base">Job Status</h2>
      <div className="flex items-center gap-6 md:gap-8">
        <div className="relative h-28 w-28 shrink-0 rounded-full bg-white/[0.06] md:h-40 md:w-40">
          <div className="absolute inset-[18%] grid place-items-center rounded-full bg-[var(--color-panel)]">
            <div className="text-center">
              <div className="mx-auto mb-1 h-5 w-8 animate-pulse rounded bg-white/[0.1]" />
              <div className="text-[11px] text-[var(--color-muted)]">Total</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs text-[var(--color-muted)] md:space-y-2 md:text-sm">
          {["Posted", "Open", "Claimed", "Submitted", "Completed"].map((label) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/15" />
                {label}
              </span>
              <span className="h-3 w-12 animate-pulse rounded bg-white/[0.08]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function JobStatusChart({
  byStatus,
  total,
  bondsLocked = 0n,
  feesSettled = 0n,
  coverageLocked = 0n,
  inFlight = 0,
  awaitingRate = 0,
  atRisk = 0,
  loading = false,
}: {
  byStatus: Record<JobStatus, number>;
  total: number;
  bondsLocked?: bigint;
  feesSettled?: bigint;
  coverageLocked?: bigint;
  inFlight?: number;
  awaitingRate?: number;
  atRisk?: number;
  loading?: boolean;
}) {
  if (loading) return <ChartSkeleton />;

  const other =
    byStatus[JobStatus.Rejected] +
    byStatus[JobStatus.Expired] +
    byStatus[JobStatus.Cancelled];

  const segments = [
    ...primary.map((s) => ({
      label: labels[s],
      count: byStatus[s],
      color: palette[labels[s]],
    })),
    { label: "Other", count: other, color: palette.Other },
  ].filter((s) => s.count > 0);

  let acc = 0;
  const stops = segments.map((s) => {
    const start = acc;
    const pct = total ? (s.count / total) * 100 : 0;
    acc += pct;
    return `${s.color} ${start}% ${acc}%`;
  });

  const targets = [
    Number(formatUnits(bondsLocked, USDC_DECIMALS)),
    Number(formatUnits(feesSettled, USDC_DECIMALS)),
    Number(formatUnits(coverageLocked, USDC_DECIMALS)),
    inFlight,
    awaitingRate,
    atRisk,
  ];

  return (
    <section className="panel flex h-full flex-col rounded-xl p-3 md:rounded-2xl md:p-3.5">
      <h2 className="mb-3 shrink-0 text-sm font-semibold md:mb-4 md:text-base">Job Status</h2>
      <div className="flex items-center gap-6 md:gap-8">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full md:h-40 md:w-40"
          style={{
            background: total === 0 ? "var(--color-line)" : `conic-gradient(${stops.join(", ")})`,
          }}
        >
          <div className="absolute inset-[18%] grid place-items-center rounded-full bg-[var(--color-panel)]">
            <div className="text-center">
              <div className="text-xl font-bold tabular-nums md:text-2xl">{total}</div>
              <div className="text-[11px] text-[var(--color-muted)]">Total</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs md:space-y-2 md:text-sm">
          {segments.map((s) => {
            const pct = total ? ((s.count / total) * 100).toFixed(1) : "0";
            return (
              <li key={s.label} className="flex items-center justify-between gap-2 md:gap-3">
                <span className="flex min-w-0 items-center gap-1.5 md:gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full md:h-2.5 md:w-2.5" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                  {s.count} · {pct}%
                </span>
              </li>
            );
          })}
          {total === 0 && <li className="text-[var(--color-muted)]">No jobs yet</li>}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--color-line)] pt-3 md:mt-0 md:min-h-0 md:flex-1 md:grid-cols-3 md:items-center md:gap-x-6 md:gap-y-5 md:border-0 md:px-1 md:py-3 md:pt-3">
        {MECH_META.map((m, i) => (
          <MechStat
            key={m.label}
            className={i >= 3 ? "md:mt-2" : undefined}
            label={m.label}
            target={targets[i]!}
            usdc={"usdc" in m && m.usdc}
            Icon={m.Icon}
            tone={m.tone}
            delay={i * 40}
          />
        ))}
      </div>
    </section>
  );
}
