import type { Address, Hex, Abi } from "viem";
import { decodeEventLog, zeroAddress } from "viem";
import { settleNetAbi, evaluatorStakeAbi, providerBondAbi } from "@/abi";
import { addresses } from "@/config/contracts";
import { JobStatus, type Job } from "@/types/job";
import { asBig } from "@/utils/format";
import { bondOf } from "@/utils/jobMath";

const ARCSCAN_API =
  import.meta.env.VITE_ARCSCAN_API || "https://testnet.arcscan.app/api/v2";

export const STAKE_COVERAGE_BP = 15_000n;
export const RATING_WINDOW_SEC = 7 * 24 * 60 * 60;
const MIN_STAKE = 10_000_000n;
const GHOST_SCORE_TENTHS = 35;

const ZERO = zeroAddress;

type ArcscanLog = {
  data: Hex;
  topics: (Hex | null)[];
  index: number;
  transaction_hash: Hex;
  block_number: number;
  block_timestamp: string;
};

type ArcscanPage<T> = {
  items: T[];
  next_page_params?: Record<string, string | number> | null;
};

type ArcscanNftInstance = {
  id: string;
  owner?: { hash?: string } | string;
  owner_address_hash?: string;
  metadata?: { name?: unknown; description?: unknown } | null;
};
type ArcscanTokenBal = {
  token?: { address_hash?: string };
  value?: string;
};

function ownerFromNft(item: ArcscanNftInstance): Address | undefined {
  if (typeof item.owner === "string" && item.owner.startsWith("0x")) return item.owner as Address;
  if (item.owner && typeof item.owner === "object" && item.owner.hash?.startsWith("0x")) {
    return item.owner.hash as Address;
  }
  if (item.owner_address_hash?.startsWith("0x")) return item.owner_address_hash as Address;
  return undefined;
}

export type DecodedLog = {
  eventName: string;
  args: Record<string, unknown>;
  txHash: Hex;
  logIndex: number;
  blockNumber: number;
  at: number;
};

export type IndexedJob = Job & {
  applicants: bigint[];
  bondLockedAmt: bigint;
  rated: boolean;
  lastScoreTenths?: number;
  cancelFee?: bigint;
};

export type IndexedAgent = {
  id: bigint;
  owner?: `0x${string}`;
  name?: string;
  description?: string;
  stake: bigint;
  maxBudget: bigint;
  maxExpiry: bigint;
  offline: boolean;
  retired: boolean;
  pendingSlash: boolean;
  ratingCount: number;
  scoreTenths: bigint;
  active: boolean;
  jobCount: number;
  locked: bigint;
  available: bigint;
  activeJobs: number;
  completedJobs: number;
  ghostJobs: number;
  settledVol: bigint;
};

export function emptyAgent(id: bigint): IndexedAgent {
  return {
    id,
    stake: 0n,
    maxBudget: 0n,
    maxExpiry: 0n,
    offline: false,
    retired: false,
    pendingSlash: false,
    ratingCount: 0,
    scoreTenths: 60n,
    active: false,
    jobCount: 0,
    locked: 0n,
    available: 0n,
    activeJobs: 0,
    completedJobs: 0,
    ghostJobs: 0,
    settledVol: 0n,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    const retry = await fetch(url);
    if (!retry.ok) throw new Error(`ArcScan ${retry.status}`);
    return retry.json() as Promise<T>;
  }
  if (!res.ok) throw new Error(`ArcScan ${res.status}`);
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function fetchPages<TItem>(
  baseUrl: string,
  firstQuery: Record<string, string | number>,
  maxPages: number,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let pageParams: Record<string, string | number> = { ...firstQuery };
  for (let i = 0; i < maxPages; i++) {
    const page: ArcscanPage<TItem> = await getJson(`${baseUrl}${qs(pageParams)}`);
    items.push(...(page.items || []));
    if (!page.next_page_params) break;
    pageParams = page.next_page_params;
  }
  return items;
}

function decodeLogs(raw: ArcscanLog[], abi: Abi): DecodedLog[] {
  const out: DecodedLog[] = [];
  for (const item of raw) {
    const topics = item.topics.filter((t): t is Hex => typeof t === "string" && t.startsWith("0x"));
    if (!topics.length) continue;
    try {
      const decoded = decodeEventLog({
        abi,
        data: item.data || "0x",
        topics: topics as [Hex, ...Hex[]],
        strict: false,
      });
      out.push({
        eventName: String(decoded.eventName),
        args: (decoded.args ?? {}) as unknown as Record<string, unknown>,
        txHash: item.transaction_hash,
        logIndex: item.index,
        blockNumber: item.block_number,
        at: Math.floor(new Date(item.block_timestamp).getTime() / 1000),
      });
    } catch {}
  }
  return out.sort((a, b) => a.at - b.at || a.logIndex - b.logIndex);
}

const asAddr = (v: unknown): Address => {
  if (typeof v === "string" && v.startsWith("0x")) return v as Address;
  return ZERO;
};

async function fetchContractLogs(address: Address, maxPages = 6): Promise<ArcscanLog[]> {
  return fetchPages<ArcscanLog>(
    `${ARCSCAN_API}/addresses/${address}/logs`,
    { items_count: 50 },
    maxPages,
  );
}

async function fetchAddressUsdcBalance(holder: Address): Promise<bigint> {
  const usdc = addresses.usdc.toLowerCase();
  const page = await getJson<ArcscanPage<ArcscanTokenBal> | ArcscanTokenBal>(
    `${ARCSCAN_API}/addresses/${holder}/tokens`,
  );
  const rows: ArcscanTokenBal[] = Array.isArray((page as ArcscanPage<ArcscanTokenBal>).items)
    ? (page as ArcscanPage<ArcscanTokenBal>).items
    : (page as ArcscanTokenBal).value
      ? [page as ArcscanTokenBal]
      : [];
  for (const row of rows) {
    if (row.token?.address_hash?.toLowerCase() === usdc && row.value) return BigInt(row.value);
  }
  return 0n;
}

function rebuildJobs(logs: DecodedLog[]): IndexedJob[] {
  type Snap = {
    client: Address;
    provider: Address;
    agentId: bigint;
    budget: bigint;
    expiredAt: bigint;
    submittedAt: bigint;
    resolvedAt: bigint;
    status: JobStatus;
    title: string;
    description: string;
    submission: string;
    applicants: bigint[];
    bondLockedAmt: bigint;
    rated: boolean;
    lastScoreTenths?: number;
    cancelFee?: bigint;
  };

  const map = new Map<string, Snap>();

  for (const ev of logs) {
    const id = ev.args.jobId != null ? String(ev.args.jobId) : null;
    if (!id) continue;
    const cur =
      map.get(id) ||
      ({
        client: ZERO,
        provider: ZERO,
        agentId: 0n,
        budget: 0n,
        expiredAt: 0n,
        submittedAt: 0n,
        resolvedAt: 0n,
        status: JobStatus.Posted,
        title: `Job #${id}`,
        description: "",
        submission: "",
        applicants: [],
        bondLockedAmt: 0n,
        rated: false,
      } satisfies Snap);

    switch (ev.eventName) {
      case "JobCreated": {
        const title =
          typeof ev.args.title === "string" && ev.args.title.trim()
            ? ev.args.title.trim()
            : `Job #${id}`;
        map.set(id, {
          ...cur,
          client: asAddr(ev.args.client),
          budget: asBig(ev.args.budget),
          expiredAt: asBig(ev.args.expiredAt),
          status: JobStatus.Posted,
          agentId: 0n,
          provider: ZERO,
          title,
          description: "",
          applicants: [],
        });
        break;
      }
      case "AgentApplied": {
        const agentId = asBig(ev.args.agentId);
        const applicants = cur.applicants.includes(agentId)
          ? cur.applicants
          : [...cur.applicants, agentId];
        map.set(id, {
          ...cur,
          status: JobStatus.AgentPending,
          applicants,
        });
        break;
      }
      case "AgentApproved":
        map.set(id, {
          ...cur,
          status: JobStatus.Open,
          agentId: asBig(ev.args.agentId, cur.agentId),
          applicants: [],
        });
        break;
      case "AgentRejected": {
        const rejected = asBig(ev.args.agentId);
        const applicants = cur.applicants.filter((a) => a !== rejected);
        if (cur.status === JobStatus.AgentPending) {
          map.set(id, {
            ...cur,
            applicants,
            agentId: 0n,
            status: applicants.length ? JobStatus.AgentPending : JobStatus.Posted,
          });
        }
        break;
      }
      case "JobClaimed":
        map.set(id, {
          ...cur,
          status: JobStatus.Claimed,
          provider: asAddr(ev.args.provider),
          bondLockedAmt: asBig(ev.args.bond),
        });
        break;
      case "JobSubmitted":
        map.set(id, {
          ...cur,
          status: JobStatus.Submitted,
          submission: String(ev.args.submission ?? cur.submission),
          submittedAt: BigInt(ev.at),
        });
        break;
      case "JobCompleted":
        map.set(id, {
          ...cur,
          status: JobStatus.Completed,
          resolvedAt: BigInt(ev.at),
          bondLockedAmt: 0n,
        });
        break;
      case "JobRejected":
        map.set(id, {
          ...cur,
          status: JobStatus.Rejected,
          resolvedAt: BigInt(ev.at),
          bondLockedAmt: 0n,
        });
        break;
      case "JobExpired":
        map.set(id, { ...cur, status: JobStatus.Expired, bondLockedAmt: 0n, rated: true });
        break;
      case "JobCancelled":
        map.set(id, {
          ...cur,
          status: JobStatus.Cancelled,
          bondLockedAmt: 0n,
          cancelFee: asBig(ev.args.evaluatorFee ?? 0),
        });
        break;
      case "EvaluatorRated":
        map.set(id, {
          ...cur,
          rated: true,
          lastScoreTenths: Number(ev.args.scoreTenths),
        });
        break;
      default:
        break;
    }
  }

  return [...map.entries()]
    .map(([id, j]) => ({
      id: BigInt(id),
      client: j.client,
      provider: j.provider,
      agentId: j.agentId,
      budget: j.budget,
      expiredAt: j.expiredAt,
      submittedAt: j.submittedAt,
      resolvedAt: j.resolvedAt,
      status: j.status,
      title: j.title,
      description: j.description,
      submission: j.submission,
      applicants: j.applicants,
      bondLockedAmt: j.bondLockedAmt,
      rated: j.rated,
      lastScoreTenths: j.lastScoreTenths,
      cancelFee: j.cancelFee,
    }))
    .sort((a, b) => Number(b.id - a.id));
}

function rebuildAgents(
  settleLogs: DecodedLog[],
  stakeLogs: DecodedLog[],
  jobs: IndexedJob[],
): IndexedAgent[] {
  type A = {
    owner?: Address;
    stake: bigint;
    maxBudget: bigint;
    maxExpiry: bigint;
    offline: boolean;
    retired: boolean;
    pendingSlash: boolean;
    ratingWeight: bigint;
    ratingScore: bigint;
    ratingCount: number;
  };

  const agents = new Map<string, A>();
  const touch = (id: string): A => {
    let a = agents.get(id);
    if (!a) {
      a = {
        stake: 0n,
        maxBudget: 0n,
        maxExpiry: 0n,
        offline: false,
        retired: false,
        pendingSlash: false,
        ratingWeight: 0n,
        ratingScore: 0n,
        ratingCount: 0,
      };
      agents.set(id, a);
    }
    return a;
  };

  for (const j of jobs) {
    if (j.agentId > 0n) touch(j.agentId.toString());
  }

  for (const ev of settleLogs) {
    if (ev.eventName === "AgentApplied" && ev.args.agentId != null) {
      touch(String(ev.args.agentId)).owner = asAddr(ev.args.owner_);
    }
    if (ev.eventName === "EvaluatorRated" && ev.args.agentId != null) {
      const a = touch(String(ev.args.agentId));
      const tenths = asBig(ev.args.scoreTenths);
      const budget = jobs.find((j) => String(j.id) === String(ev.args.jobId))?.budget ?? 1n;
      const w = budget > 0n ? budget : 1n;
      a.ratingWeight += w;
      a.ratingScore += tenths * w;
      a.ratingCount += 1;
    }
  }

  for (const ev of stakeLogs) {
    const id = ev.args.agentId != null ? String(ev.args.agentId) : null;
    if (!id) continue;
    const a = touch(id);
    switch (ev.eventName) {
      case "AgentStaked":
        a.stake = asBig(ev.args.total);
        a.owner = asAddr(ev.args.owner_);
        break;
      case "Withdrawn":
        a.stake = a.stake > asBig(ev.args.amount) ? a.stake - asBig(ev.args.amount) : 0n;
        a.owner = asAddr(ev.args.owner_);
        break;
      case "Slashed":
        a.retired = true;
        a.stake = 0n;
        a.owner = asAddr(ev.args.owner_);
        break;
      case "OfflineSet":
        a.offline = Boolean(ev.args.offline);
        break;
      case "MaxExpirySet":
        a.maxExpiry = asBig(ev.args.duration);
        break;
      case "MaxBudgetSet":
        a.maxBudget = asBig(ev.args.budget);
        break;
      case "PendingSlash":
        a.pendingSlash = true;
        break;
      default:
        break;
    }
  }

  const rows: IndexedAgent[] = [];
  for (const [id, a] of agents) {
    const agentId = BigInt(id);
    const mine = jobs.filter(
      (j) => j.agentId === agentId || j.applicants.some((a) => a === agentId),
    );
    const now = Math.floor(Date.now() / 1000);
    const locking = mine.filter((j) => {
      if (j.applicants.some((a) => a === agentId)) return true;
      if (j.agentId !== agentId) return false;
      if ([JobStatus.Open, JobStatus.Claimed, JobStatus.Submitted].includes(j.status)) return true;
      if (
        (j.status === JobStatus.Completed || j.status === JobStatus.Rejected) &&
        j.resolvedAt > 0n
      ) {
        return now < Number(j.resolvedAt) + RATING_WINDOW_SEC;
      }
      return false;
    });
    const locked = locking.reduce((s, j) => s + (j.budget * STAKE_COVERAGE_BP) / 10_000n, 0n);
    const scoreTenths = a.ratingWeight === 0n ? 60n : a.ratingScore / a.ratingWeight;
    const active =
      !a.retired &&
      a.stake >= MIN_STAKE &&
      !a.offline &&
      !a.pendingSlash &&
      a.maxExpiry !== 0n &&
      a.maxBudget !== 0n;

    rows.push({
      id: agentId,
      owner: a.owner,
      stake: a.stake,
      maxBudget: a.maxBudget,
      maxExpiry: a.maxExpiry,
      offline: a.offline,
      retired: a.retired,
      pendingSlash: a.pendingSlash,
      ratingCount: a.ratingCount,
      scoreTenths,
      active,
      jobCount: mine.length,
      locked,
      available: a.stake > locked ? a.stake - locked : 0n,
      activeJobs: locking.length + mine.filter((j) => j.status === JobStatus.Submitted).length,
      completedJobs: mine.filter((j) => j.status === JobStatus.Completed).length,
      ghostJobs: mine.filter(
        (j) => j.status === JobStatus.Expired && j.lastScoreTenths === GHOST_SCORE_TENTHS,
      ).length,
      settledVol: mine
        .filter((j) => j.status === JobStatus.Completed || j.status === JobStatus.Rejected)
        .reduce((s, j) => s + j.budget + bondOf(j.budget), 0n),
    });
  }

  return rows.sort((x, y) => Number(y.active) - Number(x.active) || Number(y.scoreTenths - x.scoreTenths));
}

async function fetchNftInstance(agentId: bigint): Promise<{
  owner?: Address;
  name: string;
  description: string;
} | null> {
  try {
    const item = await getJson<ArcscanNftInstance>(
      `${ARCSCAN_API}/tokens/${addresses.identity}/instances/${agentId}`,
    );
    const md = item.metadata;
    return {
      owner: ownerFromNft(item),
      name: typeof md?.name === "string" ? md.name.trim() : "",
      description: typeof md?.description === "string" ? md.description.trim() : "",
    };
  } catch {
    return null;
  }
}

async function refreshOwners(agents: IndexedAgent[]): Promise<IndexedAgent[]> {
  if (!agents.length) return agents;
  const need = agents
    .filter((a) => !a.owner || a.owner === ZERO || !a.name)
    .slice(0, 24);
  const extra = agents
    .filter((a) => a.active && !need.some((n) => n.id === a.id))
    .slice(0, 8);
  const batch = [...need, ...extra];
  if (!batch.length) return agents;

  const rows: Array<Awaited<ReturnType<typeof fetchNftInstance>>> = [];
  const conc = 3;
  for (let i = 0; i < batch.length; i += conc) {
    const chunk = batch.slice(i, i + conc);
    rows.push(...(await Promise.all(chunk.map((a) => fetchNftInstance(a.id)))));
  }
  const byId = new Map(batch.map((a, i) => [a.id.toString(), rows[i]]));
  return agents.map((a) => {
    const inst = byId.get(a.id.toString());
    if (!inst) return a;
    return {
      ...a,
      owner: inst.owner ?? a.owner,
      name: inst.name || a.name,
      description: inst.description || a.description,
    };
  });
}

type TvlPoint = { t: number; v: number };

function buildTvlSeries(
  settleLogs: DecodedLog[],
  stakeLogs: DecodedLog[],
  bondLogs: DecodedLog[],
): TvlPoint[] {
  type Delta = { at: number; block: number; idx: number; d: bigint };
  const deltas: Delta[] = [];
  const budgets = new Map<string, bigint>();
  const stakeByAgent = new Map<string, bigint>();

  const push = (ev: DecodedLog, d: bigint) => {
    if (d === 0n) return;
    deltas.push({ at: ev.at, block: ev.blockNumber, idx: ev.logIndex, d });
  };

  for (const ev of settleLogs) {
    const id = ev.args.jobId != null ? String(ev.args.jobId) : null;
    switch (ev.eventName) {
      case "JobCreated": {
        const budget = asBig(ev.args.budget);
        if (id) budgets.set(id, budget);
        push(ev, budget);
        break;
      }
      case "JobCompleted":
        push(ev, -(asBig(ev.args.paid) + asBig(ev.args.evaluatorFee)));
        break;
      case "JobRejected":
        push(ev, -asBig(ev.args.refund));
        break;
      case "JobCancelled":
      case "JobExpired":
        if (id) push(ev, -(budgets.get(id) ?? 0n));
        break;
      default:
        break;
    }
  }

  for (const ev of bondLogs) {
    if (ev.eventName === "BondLocked") push(ev, asBig(ev.args.amount));
    else if (ev.eventName === "BondReleased") push(ev, -asBig(ev.args.amount));
  }

  for (const ev of stakeLogs) {
    const id = ev.args.agentId != null ? String(ev.args.agentId) : null;
    if (!id) continue;
    if (ev.eventName === "AgentStaked") {
      const total = asBig(ev.args.total);
      const prev = stakeByAgent.get(id) ?? 0n;
      stakeByAgent.set(id, total);
      push(ev, total - prev);
    } else if (ev.eventName === "Withdrawn") {
      const amt = asBig(ev.args.amount);
      const prev = stakeByAgent.get(id) ?? 0n;
      stakeByAgent.set(id, prev > amt ? prev - amt : 0n);
      push(ev, -amt);
    } else if (ev.eventName === "Slashed") {
      const prev = stakeByAgent.get(id) ?? 0n;
      stakeByAgent.set(id, 0n);
      push(ev, -prev);
    }
  }

  deltas.sort((a, b) => a.block - b.block || a.idx - b.idx || a.at - b.at);

  const now = Math.floor(Date.now() / 1000);
  if (!deltas.length) return [{ t: now - 86_400, v: 0 }, { t: now, v: 0 }];

  let bal = 0n;
  const points: TvlPoint[] = [{ t: Math.max(0, deltas[0].at - 1), v: 0 }];
  for (const e of deltas) {
    bal += e.d;
    if (bal < 0n) bal = 0n;
    const v = Number(bal) / 1e6;
    const last = points[points.length - 1];
    if (last.t === e.at) last.v = v;
    else points.push({ t: e.at, v });
  }
  const last = points[points.length - 1];
  if (now > last.t) points.push({ t: now, v: last.v });
  return points;
}

export async function fetchIndexedState(): Promise<{
  jobs: IndexedJob[];
  agents: IndexedAgent[];
  settleLogs: DecodedLog[];
  stakeLogs: DecodedLog[];
  escrowed: bigint;
  agentStaked: bigint;
  bondsHeld: bigint;
  tvlSeries: TvlPoint[];
}> {
  const [settleRaw, stakeRaw, bondRaw, escrowed, agentStaked, bondsHeld] = await Promise.all([
    fetchContractLogs(addresses.settleNet, 6),
    fetchContractLogs(addresses.evaluatorStake, 6),
    fetchContractLogs(addresses.providerBond, 6),
    fetchAddressUsdcBalance(addresses.settleNet),
    fetchAddressUsdcBalance(addresses.evaluatorStake),
    fetchAddressUsdcBalance(addresses.providerBond),
  ]);
  const settleLogs = decodeLogs(settleRaw, settleNetAbi);
  const stakeLogs = decodeLogs(stakeRaw, evaluatorStakeAbi);
  const bondLogs = decodeLogs(bondRaw, providerBondAbi);
  const jobs = rebuildJobs(settleLogs);
  const agents = await refreshOwners(rebuildAgents(settleLogs, stakeLogs, jobs));
  const tvlSeries = buildTvlSeries(settleLogs, stakeLogs, bondLogs);
  return { jobs, agents, settleLogs, stakeLogs, escrowed, agentStaked, bondsHeld, tvlSeries };
}

type ArcscanTokenTransfer = {
  transaction_hash: Hex;
  log_index?: number;
  block_number: number;
  timestamp?: string;
  total?: { token_id?: string } | string;
  from?: { hash?: string } | string;
  to?: { hash?: string } | string;
};

function hashFrom(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "hash" in v && typeof (v as { hash?: string }).hash === "string") {
    return (v as { hash: string }).hash;
  }
  return "";
}

function tokenIdFrom(total: ArcscanTokenTransfer["total"]): string | undefined {
  if (typeof total === "object" && total?.token_id != null) return total.token_id;
  if (typeof total === "string") return total;
  return undefined;
}

function mapTokenTransfer(t: ArcscanTokenTransfer, i: number): DecodedLog {
  return {
    eventName: "Transfer",
    args: {
      tokenId: tokenIdFrom(t.total),
      from: hashFrom(t.from) || ZERO,
      to: hashFrom(t.to) || ZERO,
    },
    txHash: t.transaction_hash,
    logIndex: t.log_index ?? i,
    blockNumber: t.block_number,
    at: t.timestamp ? Math.floor(new Date(t.timestamp).getTime() / 1000) : 0,
  };
}

export async function fetchIdentityTransfers(
  holder: Address,
  maxPages = 2,
): Promise<DecodedLog[]> {
  const [inbound, outbound] = await Promise.all([
    fetchPages<ArcscanTokenTransfer>(
      `${ARCSCAN_API}/addresses/${holder}/token-transfers`,
      { token: addresses.identity, type: "ERC-721", filter: "to" },
      maxPages,
    ),
    fetchPages<ArcscanTokenTransfer>(
      `${ARCSCAN_API}/addresses/${holder}/token-transfers`,
      { token: addresses.identity, type: "ERC-721", filter: "from" },
      maxPages,
    ),
  ]);
  const seen = new Set<string>();
  const out: DecodedLog[] = [];
  for (const [i, t] of [...inbound, ...outbound].entries()) {
    const ev = mapTokenTransfer(t, i);
    const key = `${ev.txHash}-${ev.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out.sort((a, b) => b.at - a.at || b.logIndex - a.logIndex);
}

export async function fetchAgentTransfers(
  agentId: bigint,
  maxPages = 3,
): Promise<DecodedLog[]> {
  const raw = await fetchPages<ArcscanTokenTransfer>(
    `${ARCSCAN_API}/tokens/${addresses.identity}/instances/${agentId}/transfers`,
    {},
    maxPages,
  );
  return raw
    .map((t, i) => mapTokenTransfer(t, i))
    .sort((a, b) => b.at - a.at || b.logIndex - a.logIndex);
}

export async function fetchOwnedAgentIds(holder: Address): Promise<bigint[]> {
  const items = await fetchPages<ArcscanNftInstance>(
    `${ARCSCAN_API}/tokens/${addresses.identity}/instances`,
    { holder_address_hash: holder },
    5,
  );
  return [
    ...new Set(
      items
        .map((i) => {
          try {
            return BigInt(i.id);
          } catch {
            return null;
          }
        })
        .filter((x): x is bigint => x !== null)
        .map(String),
    ),
  ]
    .map(BigInt)
    .sort((a, b) => Number(a - b));
}
