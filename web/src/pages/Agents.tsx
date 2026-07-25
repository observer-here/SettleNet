import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { AgentCard, AgentCardSkeleton } from "@/components/agents/AgentCard";
import { AgentOnboarding } from "@/components/agents/AgentOnboarding";
import { FilterBar } from "@/components/ui/FilterBar";
import { useDiscoveredAgents, useAgentRows } from "@/hooks/useAgents";
import { useOwnedAgentIds } from "@/hooks/useIdentity";

type Tab = "mine" | "market";

function AgentGridSkeleton() {
  return (
    <div className="grid gap-2 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <AgentCardSkeleton key={i} delay={i * 70} />
      ))}
    </div>
  );
}

export function AgentsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") === "mine" ? "mine" : "market") as Tab;
  const minting = params.get("mint") === "1";
  const { isConnected } = useAccount();
  const { data: ownedIds = [], isLoading: ownedLoading, refetch } = useOwnedAgentIds();
  const empty = !isConnected || (!ownedLoading && ownedIds.length === 0);
  const showOnboarding = tab === "mine" && (minting || empty);

  const goMine = () => setParams({ tab: "mine" });
  const goMarket = () => setParams({});
  const goMint = () => setParams({ tab: "mine", mint: "1" });
  const exitMint = () => {
    void refetch();
    setParams({ tab: "mine" });
  };

  return (
    <div>
      <TopHeader
        title="Agents"
        subtitle="AI Evaluator Agents that provide trusted evaluations on SettleNet."
      />

      <ServiceGate>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 md:mb-4 sm:gap-2">
        <div className="flex gap-1 sm:gap-1.5">
          <button type="button" className={`tab ${tab === "market" && !minting ? "tab-active" : ""}`} onClick={goMarket}>
            Marketplace
          </button>
          <button type="button" className={`tab ${tab === "mine" && !minting ? "tab-active" : ""}`} onClick={goMine}>
            My Agent
          </button>
        </div>
        {isConnected && !minting && !(showOnboarding && empty) && (
          <button type="button" className="accent-btn rounded-lg px-3 py-1.5 text-sm" onClick={goMint}>
            {empty ? "Mint Agent +" : "Mint another +"}
          </button>
        )}
      </div>

      {showOnboarding ? (
        <AgentOnboarding
          another={minting && ownedIds.length > 0}
          onMinted={exitMint}
          onCancel={minting && ownedIds.length > 0 ? goMine : undefined}
        />
      ) : tab === "market" ? (
        <MarketplacePanel />
      ) : (
        <MyAgentPanel />
      )}
      </ServiceGate>
    </div>
  );
}

function MyAgentPanel() {
  const { data: ownedIds = [], isLoading } = useOwnedAgentIds();
  const { agents } = useAgentRows(ownedIds);
  const [filter, setFilter] = useState<AgentFilter>("all");
  const filtered = useMemo(
    () => agents.filter((a) => matchesFilter(a, filter)),
    [agents, filter],
  );

  return (
    <div className="space-y-2 md:space-y-4">
      <FilterBar
        visible={4}
        items={myFilters.map((f) => ({
          id: f.id,
          active: filter === f.id,
          onSelect: () => setFilter(f.id),
          content: f.label,
        }))}
      />

      {isLoading ? (
        <AgentGridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] md:rounded-xl md:p-8 md:text-sm">
          No agents in this filter.
        </div>
      ) : (
        <div className="grid gap-2 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={String(a.id)} agent={a} />
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        Next: open an agent → stake USDC → set max budget & max expiry → go online to apply on jobs.
      </p>
    </div>
  );
}

type AgentFilter =
  | "all"
  | "active"
  | "offline"
  | "inactive"
  | "retired"
  | "slash"
  | "staked"
  | "unstaked"
  | "onjob"
  | "jobs";

const myFilters: { id: AgentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "offline", label: "Offline" },
  { id: "inactive", label: "Needs setup" },
  { id: "staked", label: "Staked" },
  { id: "unstaked", label: "Unstaked" },
  { id: "onjob", label: "On a job" },
  { id: "jobs", label: "Has jobs" },
  { id: "slash", label: "Pending slash" },
  { id: "retired", label: "Retired" },
];

const marketFilters: { id: AgentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "offline", label: "Offline" },
  { id: "inactive", label: "Inactive" },
  { id: "staked", label: "Staked" },
  { id: "onjob", label: "On a job" },
  { id: "retired", label: "Retired" },
  { id: "slash", label: "Pending slash" },
];

function matchesFilter(
  a: {
    active: boolean;
    offline: boolean;
    retired: boolean;
    pendingSlash: boolean;
    stake: bigint;
    activeJobs: number;
    jobCount: number;
  },
  f: AgentFilter,
) {
  switch (f) {
    case "active":
      return a.active;
    case "offline":
      return a.offline && !a.retired;
    case "inactive":
      return !a.active && !a.offline && !a.retired && !a.pendingSlash;
    case "retired":
      return a.retired;
    case "slash":
      return a.pendingSlash;
    case "staked":
      return a.stake > 0n;
    case "unstaked":
      return a.stake === 0n;
    case "onjob":
      return a.activeJobs > 0;
    case "jobs":
      return a.jobCount > 0;
    default:
      return true;
  }
}

function MarketplacePanel() {
  const { agents, isLoading } = useDiscoveredAgents();
  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = [...agents]
      .filter((a) => matchesFilter(a, filter))
      .sort((a, b) => Number(b.active) - Number(a.active) || Number(b.scoreTenths - a.scoreTenths));
    if (s) {
      list = list.filter(
        (a) => a.id.toString().includes(s) || a.owner?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [agents, q, filter]);

  return (
    <div>
      <div className="mb-3 flex gap-1.5 md:hidden">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agent id or owner…"
          className="field min-w-0 flex-1"
        />
        <Link
          to={q.trim() ? `/agents/${q.trim()}` : "#"}
          className="ghost-btn shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
          onClick={(e) => {
            if (!q.trim()) e.preventDefault();
          }}
        >
          Go
        </Link>
      </div>

      <div className="mb-3 hidden flex-wrap gap-2 md:flex">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agent id or owner…"
          className="field max-w-md"
        />
        <div className="flex gap-2">
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Open ID"
            className="field w-28"
          />
          <Link
            to={lookup ? `/agents/${lookup}` : "#"}
            className="ghost-btn rounded-xl px-3 py-2 text-sm"
            onClick={(e) => {
              if (!lookup) e.preventDefault();
            }}
          >
            Go
          </Link>
        </div>
      </div>

      <FilterBar
        className="mb-5"
        visible={4}
        items={marketFilters.map((f) => ({
          id: f.id,
          active: filter === f.id,
          onSelect: () => setFilter(f.id),
          content: f.label,
        }))}
      />

      {isLoading ? (
        <AgentGridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="panel rounded-lg p-3 text-center text-xs text-[var(--color-muted)] sm:rounded-2xl md:p-8 md:text-sm">
          No agents in this filter. Try All, or open by ID.
        </div>
      ) : (
        <div className="grid gap-2 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={String(a.id)} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}
