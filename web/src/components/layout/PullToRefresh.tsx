import { useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export function PullToRefresh() {
  const qc = useQueryClient();
  const { pull, refreshing, threshold } = usePullToRefresh(async () => {
    await qc.refetchQueries({ type: "active" });
  });

  const show = pull > 4 || refreshing;
  const ready = pull >= threshold || refreshing;
  const y = refreshing ? threshold : pull;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-50 flex justify-center md:hidden"
      style={{ top: "max(0.5rem, env(safe-area-inset-top))", transform: `translateY(${y}px)`, opacity: show ? 1 : 0 }}
      aria-hidden={!show}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] shadow-lg ${
          ready ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className={refreshing ? "animate-spin" : ""}
          style={!refreshing ? { transform: `rotate(${Math.min(180, (pull / threshold) * 180)}deg)` } : undefined}
        >
          <path
            d="M21 12a9 9 0 1 1-2.6-6.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
