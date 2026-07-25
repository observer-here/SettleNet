import { useMemo, useState, type ComponentType, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { ACTIVITY_STATUS_UI } from "@/components/activity/WalletActivityRow";
import { CompactPager } from "@/components/ui/CompactPager";
import {
  IconArrowRight,
  IconBolt,
  IconBriefcase,
  IconCoin,
  IconStar,
} from "@/components/ui/Icons";
import {
  ACTIVITY_KIND_LINE,
  useWalletActivity,
  type ActivityKind,
  type WalletActivityItem,
} from "@/hooks/useWalletActivity";
import { formatUsdc, shortAddr } from "@/utils/format";

const TABS: { id: "all" | ActivityKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "jobs", label: "Jobs" },
  { id: "agents", label: "Agents" },
  { id: "staking", label: "Staking" },
  { id: "ratings", label: "Ratings" },
];

const FILTERS: ActivityKind[] = ["jobs", "agents", "staking", "ratings"];
const PAGE = 12;

function clock(at: number) {
  return new Date(at * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayKey(at: number) {
  const d = new Date(at * 1000);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return `Today — ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  if (same(d, yday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function MyActivityPage() {
  const { data: items, stats, earnings, isLoading, address } = useWalletActivity();
  const [tab, setTab] = useState<"all" | ActivityKind>("all");
  const [checks, setChecks] = useState<Record<ActivityKind, boolean>>({
    jobs: true,
    agents: true,
    staking: true,
    ratings: true,
  });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = items;
    if (tab !== "all") list = list.filter((i) => i.kind === tab);
    else list = list.filter((i) => checks[i.kind]);
    return list;
  }, [items, tab, checks]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageSafe = Math.min(page, pages - 1);
  const slice = filtered.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);

  const groups = useMemo(() => {
    const map = new Map<string, WalletActivityItem[]>();
    for (const i of slice) {
      const k = dayKey(i.at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    return [...map.entries()];
  }, [slice]);

  const clear = () => {
    setTab("all");
    setChecks({ jobs: true, agents: true, staking: true, ratings: true });
    setPage(0);
  };

  return (
    <div>
      <TopHeader title="My Activity" subtitle="Track all your on-chain activities across SettleNet." />

      <ServiceGate>
      <div className="space-y-0.5 md:space-y-3">
        <div className="mb-2 grid grid-cols-2 gap-1.5 md:mb-3 md:gap-2 xl:grid-cols-4" aria-busy={isLoading || undefined}>
          <Stat
            label="Total Transactions"
            value={String(stats.total)}
            Icon={IconBolt}
            tone="bg-emerald-500/15 text-[var(--color-accent)]"
            loading={isLoading}
          />
          <Stat
            label="Jobs Completed"
            value={String(stats.jobsCompleted)}
            Icon={IconBriefcase}
            tone="bg-sky-500/15 text-[var(--color-blue)]"
            loading={isLoading}
          />
          <Stat
            label="USDC Earned"
            value={formatUsdc(stats.earned)}
            Icon={IconCoin}
            tone="bg-violet-500/15 text-[var(--color-violet)]"
            loading={isLoading}
          />
          <Stat
            label="Average Rating"
            value={stats.ratingCount ? `${stats.avgRating.toFixed(1)} / 10` : "—"}
            Icon={IconStar}
            tone="bg-amber-500/15 text-[var(--color-orange)]"
            loading={isLoading}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-2 md:space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setPage(0);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
                    tab === t.id ? "accent-btn" : "ghost-btn text-[var(--color-muted)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <ul className="space-y-2.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <li
                    key={i}
                    className="panel flex items-center gap-3.5 rounded-xl border-l-[3px] border-l-white/10 px-2.5 py-2.5"
                  >
                    <span
                      className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-white/[0.08]"
                      style={{ animationDelay: `${i * 70}ms` }}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-1/2 animate-pulse rounded bg-white/[0.1]" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
                    </div>
                    <span className="h-6 w-14 shrink-0 animate-pulse rounded-md bg-white/[0.06]" />
                  </li>
                ))}
              </ul>
            ) : filtered.length === 0 ? (
              <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] md:rounded-xl md:p-8 md:text-sm">
                No activity for this filter.
              </div>
            ) : (
              <div className="space-y-2 md:space-y-4">
                {groups.map(([label, rows]) => (
                  <div key={label}>
                    <div className="mb-2.5 text-xs font-semibold text-[var(--color-muted)]">{label}</div>
                    <ul className="space-y-2.5">
                      {rows.map((item) => (
                        <Row key={item.id} item={item} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && (
              <CompactPager className="pt-1" page={pageSafe} pages={pages} onChange={setPage} />
            )}
          </div>

          <aside className="hidden space-y-2.5 lg:block">
            <div className="panel rounded-xl p-2.5">
              <div className="mb-2 text-xs font-semibold">Filter Activity</div>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                Activity Type
              </div>
              <ul className="space-y-1.5">
                {FILTERS.map((k) => (
                  <li key={k}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs capitalize">
                      <input
                        type="checkbox"
                        checked={checks[k]}
                        onChange={() => {
                          setChecks((c) => ({ ...c, [k]: !c[k] }));
                          setTab("all");
                          setPage(0);
                        }}
                        className="accent-[var(--color-accent)]"
                      />
                      {k}
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={clear} className="ghost-btn mt-2.5 w-full rounded-lg py-1.5 text-xs">
                Clear Filters
              </button>
            </div>

            <div className="panel space-y-1.5 rounded-xl p-2.5 text-xs">
              <div className="mb-1 text-xs font-semibold">Activity Summary</div>
              <Sum label="Jobs Applied" value={String(stats.applied)} loading={isLoading} />
              <Sum label="Jobs Completed" value={String(stats.jobsCompleted)} loading={isLoading} />
              <Sum label="Jobs Rejected" value={String(stats.rejected)} loading={isLoading} />
              <Sum label="Total Staked" value={`${formatUsdc(stats.staked)} USDC`} loading={isLoading} />
              <Sum label="Total Earned" value={`${formatUsdc(stats.earned)} USDC`} loading={isLoading} />
              <Sum
                label="Average Rating"
                value={stats.ratingCount ? `${stats.avgRating.toFixed(1)} / 10` : "—"}
                loading={isLoading}
              />
            </div>

            <div className="panel rounded-xl p-2.5 text-xs">
              <div className="mb-2 text-xs font-semibold">Connected Identities</div>
              <div className="mb-1 text-[10px] uppercase text-[var(--color-muted)]">Agent NFTs</div>
              {isLoading ? (
                <div className="mb-2 h-3 w-20 animate-pulse rounded bg-white/[0.08]" />
              ) : stats.ownedAgentIds.length === 0 ? (
                <p className="mb-2 text-[var(--color-muted)]">None</p>
              ) : (
                <ul className="mb-2 space-y-1">
                  {stats.ownedAgentIds.map((id) => (
                    <li key={id}>
                      <Link to={`/agents/${id}`} className="text-[var(--color-accent)] hover:underline">
                        Agent #{id}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mb-1 text-[10px] uppercase text-[var(--color-muted)]">Wallet</div>
              <div className="font-mono">{address ? shortAddr(address, 5) : "—"}</div>
            </div>

            <div className="panel rounded-xl p-2.5 text-xs">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold">Recent Earnings</span>
              </div>
              {isLoading ? (
                <ul className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="h-3 flex-1 animate-pulse rounded bg-white/[0.06]" />
                      <span className="h-3 w-10 animate-pulse rounded bg-white/[0.08]" />
                    </li>
                  ))}
                </ul>
              ) : earnings.length === 0 ? (
                <p className="text-[var(--color-muted)]">No payouts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {earnings.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-2">
                      <Link to={e.href || "#"} className="min-w-0 truncate hover:text-[var(--color-accent)]">
                        {e.detail}
                      </Link>
                      <span className="shrink-0 font-semibold text-[var(--color-accent)]">
                        +{formatUsdc(e.paid ?? 0n)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex justify-between border-t border-[var(--color-line)] pt-2 font-medium">
                <span className="text-[var(--color-muted)]">Total Earned</span>
                {isLoading ? (
                  <span className="h-3 w-14 animate-pulse rounded bg-white/[0.08]" />
                ) : (
                  <span>{formatUsdc(stats.earned)} USDC</span>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
      </ServiceGate>
    </div>
  );
}

function Stat({
  label,
  value,
  Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className="panel flex items-center gap-3 rounded-xl px-2.5 py-2">
      <span className={`icon-chip h-9 w-9 shrink-0 ${tone}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
        {loading ? (
          <div className="mt-1 h-4 w-10 animate-pulse rounded bg-white/[0.1]" />
        ) : (
          <div className="text-base font-bold tabular-nums leading-tight">{value}</div>
        )}
        <div className="text-[10px] text-[var(--color-muted)]">All time</div>
      </div>
    </div>
  );
}

function Sum({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--color-muted)]">{label}</span>
      {loading ? (
        <span className="h-3 w-10 animate-pulse rounded bg-white/[0.08]" />
      ) : (
        <span className="font-medium tabular-nums">{value}</span>
      )}
    </div>
  );
}

function Row({ item }: { item: WalletActivityItem }) {
  const st = ACTIVITY_STATUS_UI[item.status];
  const txUrl = `https://testnet.arcscan.app/tx/${item.tx}`;
  const openTx = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(txUrl, "_blank", "noopener,noreferrer");
  };
  const body = (
    <>
      <span className={`icon-chip h-10 w-10 shrink-0 ${item.tone}`}>
        <item.Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-snug">{item.title}</div>
        <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">{item.detail}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs text-[var(--color-muted)]">{clock(item.at)}</div>
        <button
          type="button"
          title="View on ArcScan"
          onClick={openTx}
          className={`mt-1 inline-flex items-center gap-1 rounded-md border border-current/20 px-2 py-0.5 text-[10px] font-bold uppercase transition hover:brightness-125 ${st.cls}`}
        >
          <st.Icon size={10} />
          {item.status}
        </button>
      </div>
      <IconArrowRight size={16} className="shrink-0 text-[var(--color-muted)]" />
    </>
  );

  const cls = `panel flex items-center gap-3.5 rounded-xl border-l-[3px] ${ACTIVITY_KIND_LINE[item.kind]} px-2.5 py-2.5 transition hover:bg-white/[0.03]`;
  if (item.href) {
    return (
      <li>
        <Link to={item.href} className={cls}>
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <a href={txUrl} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    </li>
  );
}
