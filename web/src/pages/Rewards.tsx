import { TopHeader } from "@/components/layout/TopHeader";
import { IconStar } from "@/components/ui/Icons";

export function RewardsPage() {
  return (
    <div>
      <TopHeader title="Rewards" subtitle="Incentives and points for protocol participation" />
      <div className="panel flex min-h-[240px] flex-col items-center justify-center rounded-lg px-2 py-6 text-center sm:min-h-[320px] sm:rounded-xl sm:px-4 sm:py-12">
        <span className="icon-chip mb-2 h-9 w-9 bg-amber-500/15 text-[var(--color-orange)] sm:mb-4 sm:h-12 sm:w-12">
          <IconStar size={18} />
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-base font-bold tracking-tight sm:text-xl">
          Coming soon
        </h2>
        <p className="mt-1 max-w-sm text-[11px] text-[var(--color-muted)] sm:mt-2 sm:text-sm">
          Rewards for staking, completing jobs, and evaluating will land here.
        </p>
      </div>
    </div>
  );
}
