import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useProtocolStats } from "@/hooks/useProtocolStats";
import { formatUsdc, shortAddr } from "@/utils/format";
import {
  IconBook,
  IconBriefcase,
  IconClock,
  IconLayout,
  IconList,
  IconLogoMark,
  IconStar,
  IconUsdc,
  IconUsers,
  TvlSparkline,
} from "@/components/ui/Icons";

const links: { to: string; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { to: "/", label: "Dashboard", Icon: IconLayout },
  { to: "/jobs", label: "Jobs", Icon: IconBriefcase },
  { to: "/agents", label: "Agents", Icon: IconUsers },
  { to: "/my-jobs", label: "My Jobs", Icon: IconList },
  { to: "/rewards", label: "Rewards", Icon: IconStar },
  { to: "/my-activity", label: "My Activity", Icon: IconClock },
  { to: "/faq", label: "FAQ", Icon: IconBook },
];

export function Sidebar() {
  const { address, isConnected } = useAccount();
  const { data: stats, isLoading } = useProtocolStats();
  const pending = isLoading && !stats;

  const budgetVol = stats?.budgetVol ?? 0n;
  const escrowed = stats?.escrowed ?? 0n;
  const bondVol = stats?.bondVol ?? 0n;
  const settlements = stats?.settlements ?? 0;
  const tvl = stats?.tvl ?? 0n;
  const tvlSeries = stats?.tvlSeries ?? [];

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-5">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <IconLogoMark size={32} />
        <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          SettleNet
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--color-accent)]"
                  : "text-[var(--color-muted)] hover:bg-white/[0.03] hover:text-[var(--color-text)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? "text-[var(--color-accent)]" : "opacity-80"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-2)] p-3">
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
          {isConnected && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-blue)]" />
              Arc Testnet · {shortAddr(address)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-2)] p-3.5 text-sm">
          <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Protocol Stats
          </div>
          <Row label="Budget Vol" value={formatUsdc(budgetVol)} loading={pending} usdc />
          <Row label="Bond Vol" value={formatUsdc(bondVol)} loading={pending} usdc />
          <Row label="Escrowed Vol" value={formatUsdc(escrowed)} loading={pending} usdc />
          <Row label="Settlements" value={String(settlements)} loading={pending} />
          <div className="mt-3 border-t border-[var(--color-line)] pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                TVL
              </span>
              {pending ? (
                <span className="h-3.5 w-16 animate-pulse rounded bg-white/10" />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">
                  {formatUsdc(tvl)}
                  <IconUsdc size={13} />
                </span>
              )}
            </div>
            <TvlSparkline
              points={tvlSeries}
              className={`h-9 w-full ${pending ? "opacity-40" : ""}`}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  loading,
  usdc,
}: {
  label: string;
  value: string;
  loading?: boolean;
  usdc?: boolean;
}) {
  return (
    <div className="mb-1.5 flex justify-between gap-2 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      {loading ? (
        <span className={`h-3.5 animate-pulse rounded bg-white/10 ${usdc ? "w-14" : "w-8"}`} />
      ) : (
        <span className="inline-flex items-center gap-1 font-medium tabular-nums">
          {value}
          {usdc ? <IconUsdc size={13} /> : null}
        </span>
      )}
    </div>
  );
}
