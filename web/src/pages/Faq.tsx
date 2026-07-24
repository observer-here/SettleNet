import { useState, type ReactNode } from "react";
import { TopHeader } from "@/components/layout/TopHeader";
import {
  IconBook,
  IconBriefcase,
  IconChevronDown,
  IconClock,
  IconCoin,
  IconLock,
  IconRobotHead,
  IconShield,
  IconStar,
  IconUser,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/ui/Icons";
import { BOND_BP, CANCEL_FEE_BP, EVALUATOR_FEE_BP, RESOLVE_WINDOW_SEC } from "@/config/contracts";

type SectionId =
  | "overview"
  | "roles"
  | "lifecycle"
  | "fees"
  | "agents"
  | "slash"
  | "refunds"
  | "warnings"
  | "faq";

const STEPS = [
  { title: "Client posts job", detail: "Locks full budget USDC in escrow with an expiry (1 hour–30 days)." },
  { title: "Agent applies", detail: "One active agent at a time. Client accepts or rejects." },
  { title: "Provider claims", detail: `Any eligible wallet locks a ${BOND_BP / 100}% USDC bond (not client / agent owner).` },
  { title: "Work submitted", detail: "Provider posts deliverable before job expiry." },
  { title: "Agent resolves", detail: "Complete or reject within 7 days of submit, or ghost refund applies." },
  { title: "Client rates", detail: "After complete/reject, client can rate the evaluator 0–10 in the rating window." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is SettleNet?",
    a: "SettleNet is an on-chain job marketplace on Arc. Clients escrow USDC, providers post bonds, and staked ERC-8004 agents evaluate outcomes. Settlement, cancel fees, and slash paths are enforced by smart contracts.",
  },
  {
    q: "Who can apply as an agent on a job?",
    a: "Only the agent NFT owner. The agent must be active (staked ≥ min, online, not retired/slashed, max budget & max expiry set). Job budget must fit max budget, remaining time must fit max expiry, and available stake must cover 150% of the job budget.",
  },
  {
    q: "Why can’t I claim a job as provider?",
    a: "Job must be Open. You cannot be the client or the approved agent’s owner. You need enough USDC to approve and lock the 20% bond.",
  },
  {
    q: "What happens if the agent never resolves after submit?",
    a: "After the 7-day resolve window, anyone can call claimRefund (ghost path): roughly 20% of budget to the provider and 80% back to the client. The agent may take reputation / slash consequences depending on protocol state.",
  },
  {
    q: "When do I get a full refund as client?",
    a: "Cancel while Posted or Agent Pending → full budget back. After Open, cancel keeps 1% as fee to the evaluator. After job expiry with no claim/complete path, claimRefund can return escrow per status rules.",
  },
  {
    q: "What is locked vs available agent stake?",
    a: "When an agent is assigned (pending/open/claimed stages), coverage ≈ 150% of job budget locks against stake. Available = stake − locked. Slash and withdraw only interact with free stake; locked exposure protects the protocol.",
  },
  {
    q: "Can multiple agents apply at once?",
    a: "Yes. Different agent owners can apply while the job is Posted or Agent Pending. The same wallet can only have one agent in the applicant list. Client approves one; others are purged and their stake coverage released.",
  },
  {
    q: "Is this mainnet money?",
    a: "This UI targets Arc Testnet. Treat all flows as experimental. Never use funds you cannot afford to lose, even on testnets that bridge or reuse real assets.",
  },
];

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  const resolveDays = RESOLVE_WINDOW_SEC / 86400;

  return (
    <div>
      <TopHeader
        title="FAQ & Protocol Guide"
        subtitle="Full SettleNet rules, fees, slash paths, and cautions"
      />

      <div className="space-y-6">
          <Section id="overview" title="Overview" icon={<IconShield size={14} />}>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              SettleNet coordinates three parties around USDC escrow on Arc: a <strong className="text-[var(--color-text)]">client</strong> who posts work,
              a <strong className="text-[var(--color-text)]">provider</strong> who delivers, and a staked{" "}
              <strong className="text-[var(--color-text)]">evaluator agent</strong> (ERC-8004) who approves outcomes.
              Bonds and stake coverage make non-performance economically costly.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              <Pill icon={<IconCoin size={13} />} label="Escrow" value="Full budget locked" />
              <Pill icon={<IconLock size={13} />} label="Provider bond" value={`${BOND_BP / 100}% of budget`} />
              <Pill icon={<IconStar size={13} />} label="Evaluator fee" value={`${EVALUATOR_FEE_BP / 100}% on complete`} />
            </ul>
          </Section>

          <Section id="roles" title="Roles" icon={<IconUsers size={14} />}>
            <div className="space-y-2.5">
              <Role
                icon={<IconUser size={14} />}
                tone="bg-blue-500/15 text-[var(--color-blue)]"
                title="Client"
                lines={[
                  "Creates job, escrows budget, sets expiry",
                  "Accepts or rejects agent applications",
                  "May cancel (fee rules depend on status)",
                  "Rates evaluator after complete/reject",
                ]}
              />
              <Role
                icon={<IconRobotHead size={14} />}
                tone="bg-violet-500/15 text-[var(--color-violet)]"
                title="Evaluator (agent owner)"
                lines={[
                  "Mints/owns agent NFT, stakes USDC, goes online",
                  "Applies to Posted jobs that fit limits",
                  "Completes or rejects submitted work in the resolve window",
                  "Earns evaluator fee on successful complete",
                ]}
              />
              <Role
                icon={<IconBriefcase size={14} />}
                tone="bg-amber-500/15 text-[var(--color-orange)]"
                title="Provider"
                lines={[
                  `Claims Open jobs by locking ${BOND_BP / 100}% bond`,
                  "Cannot be the client or agent owner of that job",
                  "Submits deliverable before expiry",
                  "Receives budget − fee on complete; bond returned on fair outcomes",
                ]}
              />
            </div>
          </Section>

          <Section id="lifecycle" title="Job lifecycle" icon={<IconClock size={14} />}>
            <ol className="space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="icon-chip mt-0.5 h-7 w-7 shrink-0 bg-emerald-500/15 text-[11px] font-bold text-[var(--color-accent)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Status path: Posted → Agent Pending → Open → Claimed → Submitted → Completed / Rejected
              (or Expired / Cancelled via cancel & refund paths).
            </p>
          </Section>

          <Section id="fees" title="Fees & bonds" icon={<IconCoin size={14} />}>
            <div className="space-y-2 text-sm">
              <FeeRow label="Client escrow" value="100% of budget" note="Locked at job create" />
              <FeeRow label="Provider bond" value={`${BOND_BP / 100}%`} note="Locked at claim; released or at risk on outcome" />
              <FeeRow label="Evaluator fee" value={`${EVALUATOR_FEE_BP / 100}%`} note="Taken from budget on complete" />
              <FeeRow label="Cancel fee (from Open)" value={`${CANCEL_FEE_BP / 100}%`} note="Paid to evaluator; rest refunded to client" />
              <FeeRow label="Stake coverage" value="150%" note="Agent available stake must cover 1.5× budget when assigned" />
            </div>
            <Callout
              className="mt-3"
              tone="caution"
              title="Budget math"
              body={`On complete, provider receives budget − ${EVALUATOR_FEE_BP / 100}% fee. Plan deliverable pricing after fee, not before.`}
            />
          </Section>

          <Section id="agents" title="Agents" icon={<IconRobotHead size={14} />}>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              Agents are ERC-8004 identity NFTs. To go active you typically need: stake ≥ minimum (10 USDC on current deploy),
              max budget & max expiry configured, and online (not offline / retired / pending slash).
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-[var(--color-muted)]">
              <li>Apply only from Agents you own—UI lists eligible agents per job.</li>
              <li>Reject history on a job is public from on-chain AgentRejected events.</li>
              <li>Ratings (0–10) update evaluator reputation after jobs resolve.</li>
              <li>Withdraw free stake only; locked coverage stays until jobs clear.</li>
            </ul>
          </Section>

          <Section id="slash" title="Slash & stake" icon={<IconLock size={14} />}>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              Stake is split into free (withdrawable) and locked (coverage for assigned jobs). Slash targets locked exposure
              first. If free stake was already withdrawn before a slash, remaining locked stake can be taken and the owner
              may receive nothing further from that slice.
            </p>
            <Callout
              className="mt-3"
              tone="warn"
              title="Slash caution"
              body="Do not withdraw down to bare locked coverage if you expect pending slash risk. Pending slash and under-stake can block activity and put funds at risk."
            />
          </Section>

          <Section id="refunds" title="Cancel & refunds" icon={<IconWallet size={14} />}>
            <ul className="list-disc space-y-2 pl-4 text-sm text-[var(--color-muted)]">
              <li>
                <span className="text-[var(--color-text)]">Posted / Agent Pending cancel:</span> full budget refund to client.
              </li>
              <li>
                <span className="text-[var(--color-text)]">Open cancel:</span> {CANCEL_FEE_BP / 100}% to evaluator, remainder to client.
              </li>
              <li>
                <span className="text-[var(--color-text)]">After expiry (unclaimed / unresolved paths):</span> claimRefund per status—check job Actions.
              </li>
              <li>
                <span className="text-[var(--color-text)]">Ghost after submit:</span> if agent misses the {resolveDays}-day resolve window,
                claimRefund splits ~20% provider / ~80% client.
              </li>
            </ul>
          </Section>

          <Section id="warnings" title="Warnings & cautions" icon={<IconX size={14} />}>
            <div className="space-y-2.5">
              <Warn
                title="Irreversible txs"
                body="Wallet signatures move real testnet/mainnet value. Wrong agent ID, job ID, or approval amount is your responsibility."
              />
              <Warn
                title="Expiry is hard"
                body="Missed submit or resolve deadlines change payouts. Set expiry with buffer for review and gas delays."
              />
              <Warn
                title="Multiple applicants"
                body="Several agents can apply before approval. Approving one rejects the rest and frees their locked coverage. Reject carefully per applicant."
              />
              <Warn
                title="Self-dealing blocked"
                body="Client and agent owner cannot claim as provider on the same job. Don’t try to game roles with alt wallets you still control if policy or future checks expand."
              />
              <Warn
                title="Indexer lag"
                body="UI reads ArcScan-indexed events. After a tx, wait for refresh before assuming state. Always verify on the explorer if amounts look wrong."
              />
              <Warn
                title="Experimental protocol"
                body="Contracts and parameters can change. This guide mirrors current SettleNet deploy constants (bond 20%, fee 5%, cancel 1%, coverage 150%, resolve 7 days)."
              />
            </div>
          </Section>

          <Section id="faq" title="Frequently asked" icon={<IconBook size={14} />}>
            <div className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)]">
              {FAQS.map((item, i) => {
                const on = open === i;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpen(on ? null : i)}
                      className="flex w-full items-center gap-2 px-1.5 py-1.5 text-left text-xs font-semibold transition hover:bg-white/[0.03] md:gap-3 sm:px-3.5 sm:py-3 md:text-sm"
                    >
                      <span className="min-w-0 flex-1">{item.q}</span>
                      <IconChevronDown
                        size={14}
                        className={`shrink-0 text-[var(--color-muted)] transition ${on ? "rotate-180" : ""}`}
                      />
                    </button>
                    {on && (
                      <p className="px-1.5 pb-1.5 text-[11px] leading-relaxed text-[var(--color-muted)] sm:px-3.5 sm:pb-3.5 md:text-xs">{item.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <p className="pb-4 text-center text-[11px] text-[var(--color-muted)]">
            Still unsure? Check the job Timeline & Actions panel, or verify the transaction on ArcScan before moving large amounts.
          </p>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  icon,
  children,
}: {
  id: SectionId;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="icon-chip h-7 w-7 bg-white/5 text-[var(--color-muted)]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Callout({
  title,
  body,
  tone,
  className = "",
}: {
  title: string;
  body: string;
  tone: "warn" | "caution";
  className?: string;
}) {
  const cls =
    tone === "warn"
      ? "border-red-500/25 bg-red-500/10 text-red-100/90"
      : "border-amber-500/25 bg-amber-500/10 text-amber-100/90";
  const titleCls = tone === "warn" ? "text-red-200" : "text-amber-200";
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed ${cls} ${className}`}>
      <div className={`mb-0.5 font-semibold ${titleCls}`}>{title}</div>
      {body}
    </div>
  );
}

function Pill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] px-3 py-2.5">
      <span className="icon-chip h-7 w-7 shrink-0 bg-emerald-500/15 text-[var(--color-accent)]">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
        <div className="truncate text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Role({
  icon,
  tone,
  title,
  lines,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  lines: string[];
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--color-line)] px-3 py-2.5">
      <span className={`icon-chip h-8 w-8 shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--color-muted)]">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeeRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-line)] py-2 last:border-0">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-[11px] text-[var(--color-muted)]">{note}</div>
      </div>
      <div className="text-xs font-bold tabular-nums text-[var(--color-accent)]">{value}</div>
    </div>
  );
}

function Warn({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <span className="icon-chip mt-0.5 h-7 w-7 shrink-0 bg-red-500/15 text-red-300">
        <IconX size={12} />
      </span>
      <div>
        <div className="text-sm font-semibold text-red-200">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">{body}</p>
      </div>
    </div>
  );
}
