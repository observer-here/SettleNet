import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { JobCard, JobListSkeleton } from "@/components/jobs/JobCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { CompactPager } from "@/components/ui/CompactPager";
import { JOB_STATUS_VISUAL } from "@/components/ui/StatusBadge";
import { IconChevronDown, IconList } from "@/components/ui/Icons";
import { useJobs } from "@/hooks/useJobs";
import { useWriteSettle } from "@/hooks/useContracts";
import { useIndexedState } from "@/hooks/useIndexedState";
import { JobStatus } from "@/types/job";
import { claimJobWithBond } from "@/utils/claimJob";
import { canClaimJob } from "@/utils/jobMath";

const PAGE = 10;

const TABS: Array<{ id: JobStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: JobStatus.Open, label: "Open Jobs" },
  { id: JobStatus.Posted, label: "Posted" },
  { id: JobStatus.AgentPending, label: "Agent Pending" },
  { id: JobStatus.Claimed, label: "Claimed" },
  { id: JobStatus.Submitted, label: "Submitted" },
  { id: JobStatus.Completed, label: "Completed" },
  { id: JobStatus.Rejected, label: "Rejected" },
  { id: JobStatus.Expired, label: "Expired" },
  { id: JobStatus.Cancelled, label: "Cancelled" },
];

type BudgetFilter = "any" | "lt100" | "100to500" | "gt500";
type ExpiryFilter = "any" | "lt1d" | "lt7d" | "gt7d";
type SortKey = "newest" | "budgetDesc" | "budgetAsc" | "expiry";

export function JobsPage() {
  const { address } = useAccount();
  const { jobs, isLoading, refetch } = useJobs();
  const { data: indexed } = useIndexedState();
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [budgetF, setBudgetF] = useState<BudgetFilter>("any");
  const [expiryF, setExpiryF] = useState<ExpiryFilter>("any");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(0);
  const { writeContractAsync, isPending } = useWriteSettle();
  const [claiming, setClaiming] = useState<bigint | null>(null);

  const scores = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of indexed?.agents ?? []) {
      m.set(a.id.toString(), Number(a.scoreTenths) / 10);
    }
    return m;
  }, [indexed?.agents]);

  const myAgentIds = useMemo(() => {
    if (!address || !indexed) return new Set<string>();
    const a = address.toLowerCase();
    return new Set(
      indexed.agents.filter((x) => x.owner?.toLowerCase() === a).map((x) => x.id.toString()),
    );
  }, [indexed, address]);

  const counts = useMemo(() => {
    const c = new Map<JobStatus | "all", number>();
    c.set("all", jobs.length);
    for (const s of Object.values(JobStatus)) {
      if (typeof s === "number") c.set(s, 0);
    }
    for (const j of jobs) c.set(j.status, (c.get(j.status) ?? 0) + 1);
    return c;
  }, [jobs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = Date.now() / 1000;
    let list = jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (s) {
        const hit =
          (j.title || "").toLowerCase().includes(s) ||
          j.description.toLowerCase().includes(s) ||
          j.id.toString().includes(s) ||
          (j.agentId > 0n && j.agentId.toString().includes(s));
        if (!hit) return false;
      }
      const usdc = Number(j.budget) / 1e6;
      if (budgetF === "lt100" && !(usdc < 100)) return false;
      if (budgetF === "100to500" && !(usdc >= 100 && usdc <= 500)) return false;
      if (budgetF === "gt500" && !(usdc > 500)) return false;
      const left = Number(j.expiredAt) - now;
      if (expiryF === "lt1d" && !(left > 0 && left < 86400)) return false;
      if (expiryF === "lt7d" && !(left > 0 && left < 7 * 86400)) return false;
      if (expiryF === "gt7d" && !(left >= 7 * 86400)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "budgetDesc") return Number(b.budget - a.budget);
      if (sort === "budgetAsc") return Number(a.budget - b.budget);
      if (sort === "expiry") return Number(a.expiredAt - b.expiredAt);
      return Number(b.id - a.id);
    });
    return list;
  }, [jobs, filter, q, budgetF, expiryF, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageSafe = Math.min(page, pages - 1);
  const slice = filtered.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);

  const claim = async (jobId: bigint, budget: bigint) => {
    if (!address) return;
    setClaiming(jobId);
    try {
      await claimJobWithBond(writeContractAsync, jobId, budget);
      await refetch();
    } finally {
      setClaiming(null);
    }
  };

  const setTab = (id: JobStatus | "all") => {
    setFilter(id);
    setPage(0);
  };

  return (
    <div>
      <TopHeader
        title="Jobs"
        subtitle="Browse and discover jobs posted by clients."
        actions={
          <Link
            to="/jobs/new"
            className="accent-btn inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs md:px-3 md:py-2 md:text-[13px]"
          >
            Create Job +
          </Link>
        }
      />

      <ServiceGate>
      <FilterBar
        visible={4}
        items={TABS.map((t) => {
          const n = counts.get(t.id) ?? 0;
          const active = filter === t.id;
          const vis = t.id === "all" ? null : JOB_STATUS_VISUAL[t.id];
          const TabIcon = vis?.Icon ?? IconList;
          return {
            id: String(t.id),
            active,
            onSelect: () => setTab(t.id),
            content: (
              <>
                <TabIcon
                  size={13}
                  className={active ? undefined : t.id === "all" ? "text-[var(--color-muted)]" : vis?.iconColor}
                />
                {t.label}
                {t.id !== "all" && (
                  <span className={`ml-0.5 tabular-nums ${active ? "" : "text-[var(--color-muted)]"}`}>
                    {isLoading ? (
                      <span className="inline-block h-3 w-4 animate-pulse rounded bg-white/10 align-middle" />
                    ) : (
                      n
                    )}
                  </span>
                )}
              </>
            ),
          };
        })}
      />

      <div className="mb-3 flex flex-col gap-1.5 md:mb-5 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search title, description, or ID…"
          className="field w-full min-w-0 flex-1 md:max-w-md"
        />
        <div className="grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:gap-2">
          <Select
            value={budgetF}
            onChange={(v) => {
              setBudgetF(v as BudgetFilter);
              setPage(0);
            }}
            options={[
              { value: "any", label: "Budget" },
              { value: "lt100", label: "< 100 USDC" },
              { value: "100to500", label: "100–500 USDC" },
              { value: "gt500", label: "> 500 USDC" },
            ]}
          />
          <Select
            value={expiryF}
            onChange={(v) => {
              setExpiryF(v as ExpiryFilter);
              setPage(0);
            }}
            options={[
              { value: "any", label: "Expiry" },
              { value: "lt1d", label: "< 24 hours" },
              { value: "lt7d", label: "< 7 days" },
              { value: "gt7d", label: "7+ days" },
            ]}
          />
          <Select
            value={sort}
            onChange={(v) => {
              setSort(v as SortKey);
              setPage(0);
            }}
            options={[
              { value: "newest", label: "Sort: Newest" },
              { value: "budgetDesc", label: "Budget: High" },
              { value: "budgetAsc", label: "Budget: Low" },
              { value: "expiry", label: "Expiry: Soon" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <JobListSkeleton />
      ) : slice.length === 0 ? (
        <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] md:rounded-xl md:p-8 md:text-sm">
          No jobs in this filter.
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {slice.map((job) => (
            <JobCard
              key={String(job.id)}
              job={job}
              agentScore={
                job.agentId > 0n ? scores.get(job.agentId.toString()) : undefined
              }
              showClaim={canClaimJob(job, address, myAgentIds)}
              actionPending={claiming === job.id || isPending}
              onAction={
                canClaimJob(job, address, myAgentIds)
                  ? () => void claim(job.id, job.budget)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <CompactPager className="mt-5" page={pageSafe} pages={pages} onChange={setPage} />
      </ServiceGate>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field w-full min-w-0 appearance-none truncate pr-7 text-[11px] md:pr-8 md:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={12}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] md:right-2.5"
      />
    </div>
  );
}
