import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useScrollHide } from "@/hooks/useScrollHide";

export function TopHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const hidden = useScrollHide();
  const ref = useRef<HTMLElement>(null);
  const [pad, setPad] = useState(64);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setPad(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title, subtitle, actions]);

  return (
    <>
      <div style={{ height: pad }} className="shrink-0" aria-hidden />
      <header
        ref={ref}
        className={`fixed top-0 right-0 left-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-ink)]/95 px-2 py-2 backdrop-blur-md transition-transform duration-200 ease-out md:left-[260px] md:px-4 lg:px-5 ${
          hidden ? "-translate-y-full pointer-events-none" : "translate-y-0"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 md:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight md:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-muted)] md:text-xs">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 md:gap-2">
            {actions}
            <div className="origin-right scale-90 md:scale-100">
              <ConnectButton chainStatus="none" accountStatus="address" showBalance={false} />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
