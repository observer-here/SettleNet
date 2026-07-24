import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CompactPager } from "@/components/ui/CompactPager";
import { useSettleNetActivity } from "@/hooks/useActivity";
import { relativeTime } from "@/utils/format";

const PAGE = 6;

export function RecentActivity() {
  const { data: items = [], isLoading, error } = useSettleNetActivity();
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = useMemo(() => items.slice(cur * PAGE, cur * PAGE + PAGE), [items, cur]);

  return (
    <section className="panel h-full rounded-xl p-3 md:rounded-2xl md:p-3.5">
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <h2 className="text-sm font-semibold md:text-base">Recent Activity</h2>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-muted)] md:text-xs">
          <span className="live-dot" aria-hidden />
          Live
        </span>
      </div>
      {isLoading ? (
        <ul className="space-y-2 md:space-y-3">
          {Array.from({ length: PAGE }, (_, i) => (
            <li key={i} className="flex items-start gap-2 md:gap-3">
              <span
                className="mt-0.5 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-white/[0.08] md:h-8 md:w-8"
                style={{ animationDelay: `${i * 70}ms` }}
              />
              <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.1]" />
                <div className="h-2.5 w-2/5 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="text-xs text-[var(--color-muted)] md:text-sm">Could not load ArcScan logs.</p>
      ) : slice.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] md:text-sm">No SettleNet events indexed yet.</p>
      ) : (
        <>
          <ul className="space-y-2 md:space-y-3">
            {slice.map((item) => (
              <li key={item.id} className="flex items-start gap-2 md:gap-3">
                <span className={`icon-chip mt-0.5 h-7 w-7 shrink-0 md:h-8 md:w-8 ${item.tone}`}>
                  <item.Icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link to={item.href} className="text-xs font-medium hover:text-[var(--color-accent)] md:text-sm">
                      {item.title}
                    </Link>
                  ) : (
                    <div className="text-xs font-medium md:text-sm">{item.title}</div>
                  )}
                  <div className="truncate text-[10px] text-[var(--color-muted)] md:text-xs">{item.detail}</div>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)] md:text-xs">
                  {relativeTime(item.at)}
                </span>
              </li>
            ))}
          </ul>
          <CompactPager className="mt-2 md:mt-3" page={cur} pages={pages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
