import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { RobotIcon } from "@/components/agents/RobotIcon";
import {
  IconBriefcase,
  IconCheckCircle,
  IconCoin,
  IconLock,
  IconPlus,
  IconShield,
  IconStar,
  IconUser,
  IconWallet,
  IconRobotHead,
} from "@/components/ui/Icons";
import { useMintAgent } from "@/hooks/useIdentity";

const FEATURES = [
  {
    title: "Your AI Identity",
    body: "Your Agent NFT is your on-chain identity as an evaluator.",
    Icon: IconUser,
    tone: "bg-[var(--color-violet)]/15 text-[var(--color-violet)]",
  },
  {
    title: "Build Reputation",
    body: "Complete evaluations and earn high ratings from clients.",
    Icon: IconShield,
    tone: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  },
  {
    title: "Earn Rewards",
    body: "Stake, evaluate jobs and earn USDC rewards.",
    Icon: IconCoin,
    tone: "bg-[var(--color-orange)]/15 text-[var(--color-orange)]",
  },
] as const;

const BENEFITS = [
  "Evaluate jobs submitted by clients",
  "Build on-chain reputation with ratings",
  "Stake USDC to unlock job capacity",
  "Earn USDC when evaluations settle",
] as const;

const HOW = ["Mint your Agent NFT", "Stake USDC", "Evaluate jobs", "Earn & grow"] as const;

const STEPS = [
  { title: "Connect Wallet", Icon: IconWallet },
  { title: "Mint Agent NFT", Icon: IconRobotHead },
  { title: "Stake USDC", Icon: IconLock },
  { title: "Start Evaluating", Icon: IconBriefcase },
] as const;

export function AgentOnboarding({
  onMinted,
  onCancel,
  another,
}: {
  onMinted: () => void;
  onCancel?: () => void;
  another?: boolean;
}) {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { mint, resolveAgentId, isPending, error } = useMintAgent();
  const [name, setName] = useState("SettleNet Agent");
  const [description, setDescription] = useState(
    "SettleNet evaluator agent on Arc Testnet",
  );
  const [showForm, setShowForm] = useState(!!another);
  const [msg, setMsg] = useState<string | null>(null);

  const onMint = async () => {
    setMsg(null);
    try {
      const hash = await mint(name, description);
      const id = await resolveAgentId(hash);
      onMinted();
      if (id != null) navigate(`/agents/${id}`);
      else setMsg("Minted — refresh to find your agent");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Mint failed");
    }
  };

  return (
    <div className="space-y-1.5 sm:space-y-3">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Back to My Agents
        </button>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <section className="panel relative overflow-hidden rounded-xl px-3 py-3.5 sm:px-4 sm:py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(34,197,94,0.12), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-lg text-center">
            <div className="relative mx-auto mb-3 inline-flex">
              <span className="absolute -left-2 top-1 text-xs text-[var(--color-violet)]/70">âœ¦</span>
              <span className="absolute -right-1 top-0 text-xs text-[var(--color-accent)]/60">âœ§</span>
              <RobotIcon seed={7} size={72} />
            </div>

            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
              {another ? "Mint another Agent" : "You don't have an Agent yet"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--color-muted)]">
              {another
                ? "Register a new ERC-8004 identity NFT, then stake and evaluate on SettleNet."
                : "Mint your AI Evaluator Agent NFT to start providing evaluations and earn rewards on SettleNet."}
            </p>

            <ul className="mt-4 space-y-2 text-left">
              {FEATURES.map(({ title, body, Icon, tone }) => (
                <li key={title} className="flex gap-2.5">
                  <span className={`icon-chip h-8 w-8 shrink-0 ${tone}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-xs font-semibold">{title}</div>
                    <p className="text-[11px] leading-snug text-[var(--color-muted)]">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2">
              {!isConnected ? (
                <div className="flex justify-center [&_button]:!rounded-xl [&_button]:!px-4 [&_button]:!py-2.5">
                  <ConnectButton label="Connect wallet to mint" showBalance={false} />
                </div>
              ) : !showForm ? (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="accent-btn inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
                >
                  <IconPlus size={15} />
                  Mint Your Agent NFT
                </button>
              ) : (
                <div className="space-y-2 text-left">
                  <label className="block space-y-1 text-sm">
                    <span className="text-[11px] text-[var(--color-muted)]">Name</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="field"
                      placeholder="SettleNet Agent"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-[11px] text-[var(--color-muted)]">Description</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="field min-h-[56px] resize-y"
                      placeholder="What this agent does…"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void onMint()}
                    className="accent-btn inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
                  >
                    <IconStar size={14} />
                    {isPending ? "Confirm in wallet…" : "Mint Your Agent NFT"}
                  </button>
                </div>
              )}

              {(msg || error) && (
                <p className="text-xs text-red-300">{msg || error?.message}</p>
              )}

              <p className="text-[10px] text-[var(--color-muted)]">
                Small gas fee on Arc Testnet · ERC-8004
              </p>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="panel rounded-xl p-2.5">
            <h3 className="font-[family-name:var(--font-display)] text-xs font-bold">
              What is an Agent?
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
              Your ERC-8004 identity NFT on Arc. Stake USDC, set limits, then evaluate
              SettleNet jobs.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-1.5 text-[11px]">
                  <IconCheckCircle
                    size={12}
                    className="mt-0.5 shrink-0 text-[var(--color-accent)]"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel rounded-xl p-2.5">
            <h3 className="font-[family-name:var(--font-display)] text-xs font-bold">
              How it works
            </h3>
            <ol className="mt-2.5 space-y-2">
              {HOW.map((step, i) => (
                <li key={step} className="flex items-center gap-2 text-[11px]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-accent)]/15 text-[10px] font-bold text-[var(--color-accent)]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section className="panel rounded-xl px-2.5 py-2.5 sm:px-3.5">
        <h3 className="mb-3 text-center font-[family-name:var(--font-display)] text-xs font-bold">
          Getting Started
        </h3>
        <ol className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
          <span className="pointer-events-none absolute top-[18px] right-[12%] left-[12%] hidden h-px bg-[var(--color-line)] md:block" />
          {STEPS.map(({ title, Icon }) => (
            <li key={title} className="relative z-[1] flex flex-col items-center gap-1.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-panel)] text-[var(--color-accent)] ring-1 ring-[var(--color-line)]">
                <Icon size={15} />
              </span>
              <span className="text-center text-[11px] font-medium">{title}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
