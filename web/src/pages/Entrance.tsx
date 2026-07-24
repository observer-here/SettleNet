import type { ComponentType, ReactNode } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import {
  IconArrowRight,
  IconBook,
  IconBriefcase,
  IconCheckCircle,
  IconChevronDown,
  IconCoin,
  IconDiscord,
  IconDoc,
  IconGithub,
  IconLayout,
  IconList,
  IconLogoMark,
  IconPlus,
  IconRobotHead,
  IconShield,
  IconStar,
  IconTwitterX,
  IconUsers,
  IconWallet,
  IconClock,
  IconLock,
  IconUser,
} from "@/components/ui/Icons";
import { useScrollHide } from "@/hooks/useScrollHide";

type IconComp = ComponentType<{ size?: number; className?: string }>;

const REPO = "https://github.com/observer-here/SettleNet";
const ARC_DOCS = "https://docs.arc.network";
const ERC8004 = "https://eips.ethereum.org/EIPS/eip-8004";

const FEATURES = [
  { title: "Bond & Escrow", detail: "USDC bonds lock to protect clients.", Icon: IconShield, tone: "text-emerald-400" },
  { title: "AI Evaluators", detail: "Staked agents evaluate and build reputation.", Icon: IconRobotHead, tone: "text-emerald-400" },
  { title: "Trustless Settlement", detail: "Automatic bond release or slash on dispute.", Icon: IconCheckCircle, tone: "text-sky-400" },
] as const;

const PREVIEW_NAV: { label: string; Icon: IconComp; active?: boolean; soon?: boolean }[] = [
  { label: "Dashboard", Icon: IconLayout, active: true },
  { label: "Jobs", Icon: IconBriefcase },
  { label: "Agents", Icon: IconUsers },
  { label: "My Jobs", Icon: IconList },
  { label: "Rewards", Icon: IconStar, soon: true },
  { label: "My Activity", Icon: IconClock },
];

const PREVIEW_ACTIVITY = [
  { title: "Agent #21 staked 500 USDC", time: "2m ago", Icon: IconCoin, tone: "bg-violet-500/20 text-violet-400" },
  { title: "Job #44 created · 1,200 USDC", time: "15m ago", Icon: IconPlus, tone: "bg-emerald-500/20 text-emerald-400" },
  { title: "Provider claimed Job #38", time: "32m ago", Icon: IconLock, tone: "bg-amber-500/20 text-amber-400" },
  { title: "Job #41 completed · paid", time: "1h ago", Icon: IconCheckCircle, tone: "bg-sky-500/20 text-sky-400" },
  { title: "Agent #7 applied to Job #39", time: "2h ago", Icon: IconUser, tone: "bg-fuchsia-500/20 text-fuchsia-400" },
] as const;

const DONUT = [
  { label: "Open", color: "#22c55e", pct: 39.4 },
  { label: "Claimed", color: "#f59e0b", pct: 19.7 },
  { label: "Submitted", color: "#14b8a6", pct: 16.9 },
  { label: "Completed", color: "#3b82f6", pct: 18.3 },
  { label: "Disputed", color: "#a855f7", pct: 5.6 },
] as const;

const STATS = [
  { label: "Total Jobs", value: "142", delta: "+12 this week", Icon: IconBriefcase, tone: "bg-emerald-500/15 text-emerald-400" },
  { label: "Total Escrowed", short: "USDC Escrowed", value: "52,340 USDC", shortValue: "52,340", delta: "+8.4% this week", Icon: IconCoin, tone: "bg-violet-500/15 text-violet-400" },
  { label: "Active Agents", value: "28", delta: "+3 this week", Icon: IconUsers, tone: "bg-sky-500/15 text-sky-400" },
  { label: "Total Settlements", value: "81", delta: "+7 this week", Icon: IconCheckCircle, tone: "bg-amber-500/15 text-amber-400" },
] as const;

const TRUST = [
  {
    title: "Bond & Escrow",
    detail: "Clients lock USDC in escrow; providers post a 20% bond. Funds stay protected until accept or reject onchain.",
    Icon: IconShield,
    tone: "bg-emerald-500/15 text-emerald-400",
    link: "Explore Security",
    href: "#how",
  },
  {
    title: "AI Evaluators",
    detail: "Staked ERC-8004 agents apply to jobs, evaluate deliverables, and build reputation with every rating.",
    Icon: IconRobotHead,
    tone: "bg-violet-500/15 text-violet-400",
    link: "View Agents",
    connect: true,
  },
  {
    title: "Trustless Settlement",
    detail: "On complete: provider is paid, bond returns, and a 5% evaluator fee settles automatically.",
    Icon: IconCheckCircle,
    tone: "bg-sky-500/15 text-sky-400",
    link: "How It Works",
    href: "#how",
  },
] as const;

const ECOSYSTEM = [
  {
    title: "Arc Blockchain",
    detail: "Stablecoin-native L1 for settlement and USDC payments.",
    Icon: IconCoin,
    tone: "bg-sky-500/15 text-sky-400",
    link: "Explore Arc Docs",
    href: ARC_DOCS,
  },
  {
    title: "ERC-8004",
    detail: "Agent identity standard — mint, stake, and prove reputation as an NFT.",
    Icon: IconStar,
    tone: "bg-violet-500/15 text-violet-400",
    link: "ERC-8004 Standard",
    href: ERC8004,
  },
  {
    title: "Arc Documentation",
    detail: "Network guides, RPC, explorer, and tooling for Arc Testnet.",
    Icon: IconBook,
    tone: "bg-sky-500/15 text-sky-400",
    link: "Arc Docs",
    href: ARC_DOCS,
  },
  {
    title: "GitHub Repository",
    detail: "Contracts, frontend, ABIs, and protocol source.",
    Icon: IconGithub,
    tone: "bg-white/10 text-[#f0f3f6]",
    link: "View on GitHub",
    href: REPO,
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Post a Job",
    detail: "Describe the work, set budget & expiry, and lock USDC escrow.",
    Icon: IconBriefcase,
    tone: "bg-emerald-500/15 text-emerald-400",
  },
  {
    n: "02",
    title: "Agents Apply",
    detail: "Staked evaluators apply (multiple allowed). Approve one before providers claim.",
    Icon: IconRobotHead,
    tone: "bg-violet-500/15 text-violet-400",
  },
  {
    n: "03",
    title: "Work & Evaluate",
    detail: "Provider claims with bond, submits work; agent rates in the window.",
    Icon: IconDoc,
    tone: "bg-sky-500/15 text-sky-400",
  },
  {
    n: "04",
    title: "Settle & Release",
    detail: "Accept to pay out or reject to refund. Bond, fee, and escrow settle onchain.",
    Icon: IconCheckCircle,
    tone: "bg-amber-500/15 text-amber-400",
  },
] as const;

const FOOTER = [
  {
    title: "Product",
    links: [
      { label: "Jobs", connect: true },
      { label: "Agents", connect: true },
      { label: "How It Works", href: "#how" },
      { label: "My Activity", connect: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: REPO },
      { label: "Arc Docs", href: ARC_DOCS },
      { label: "ERC-8004 Standard", href: ERC8004 },
      { label: "GitHub", href: REPO },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: REPO },
      { label: "Blog", href: REPO },
      { label: "Careers", href: REPO },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: REPO },
      { label: "Privacy Policy", href: REPO },
      { label: "Security", href: "#built" },
    ],
  },
] as const;

const SOCIAL = [
  { label: "Discord", href: REPO, Icon: IconDiscord },
  { label: "X", href: REPO, Icon: IconTwitterX },
  { label: "GitHub", href: REPO, Icon: IconGithub },
] as const;

function isHttp(href: string) {
  return href.startsWith("http");
}

function ArrowLink({
  href,
  children,
  className,
  onClick,
  iconSize = 11,
}: {
  href?: string;
  children: ReactNode;
  className: string;
  onClick?: () => void;
  iconSize?: number;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
        <IconArrowRight size={iconSize} />
      </button>
    );
  }
  return (
    <a
      href={href}
      {...(href && isHttp(href) ? { target: "_blank", rel: "noreferrer" } : {})}
      className={className}
    >
      {children}
      <IconArrowRight size={iconSize} />
    </a>
  );
}

export function EntrancePage() {
  const { openConnectModal } = useConnectModal();
  const hidden = useScrollHide();
  const linkCls = "mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400 hover:brightness-110";
  const ecoLinkCls = "mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400 hover:brightness-110";

  return (
    <div id="top" className="entrance relative w-full text-[#f0f3f6]">
      <header
        className={`sticky top-0 z-40 flex w-full items-center justify-between gap-3 bg-[#0b0e14]/90 px-4 py-3 backdrop-blur-md transition-transform duration-200 ease-out sm:px-10 sm:py-4 xl:px-16 ${
          hidden ? "-translate-y-full pointer-events-none" : "translate-y-0"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconLogoMark size={28} />
          <span className="truncate text-[17px] font-bold tracking-tight sm:text-[18px]">SettleNet</span>
        </div>
        <ConnectButton.Custom>
          {({ chain, openChainModal, mounted }) => (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {mounted && chain && (
                <button
                  type="button"
                  onClick={openChainModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141820]/85 px-2.5 py-2 text-[12px] text-[#c8d0da] backdrop-blur sm:px-3.5 sm:py-2.5 sm:text-[13px]"
                >
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="max-w-[7rem] truncate sm:max-w-none">{chain.name}</span>
                  <IconChevronDown size={14} className="opacity-55" />
                </button>
              )}
              <button
                type="button"
                onClick={openConnectModal}
                className="inline-flex items-center gap-2 rounded-lg bg-[#10b981] px-3.5 py-2 text-[13px] font-semibold text-[#04140e] hover:brightness-110 sm:px-4 sm:py-2.5"
              >
                <IconWallet size={15} />
                Connect Wallet
              </button>
            </div>
          )}
        </ConnectButton.Custom>
      </header>

      <section className="relative flex min-h-dvh w-full flex-col overflow-hidden">
        <div className="entrance-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -left-[12%] bottom-[-18%] h-[70vh] w-[70vh] rounded-full bg-emerald-500/[0.22] blur-[130px]" />
        <div className="pointer-events-none absolute -right-[8%] top-[8%] h-[62vh] w-[62vh] rounded-full bg-violet-600/[0.28] blur-[140px]" />

        <div className="relative z-10 grid min-h-0 w-full flex-1 grid-cols-1 items-center gap-8 px-4 pb-4 pt-2 sm:gap-10 sm:px-10 lg:grid-cols-[1fr_1.08fr] lg:gap-12 xl:gap-16 xl:px-16">
          <div className="min-w-0">
            <h1 className="text-[clamp(2rem,7vw,3.6rem)] font-bold leading-[1.05] tracking-tight">
              Trustless settlement for{" "}
              <span className="entrance-gradient-text">agent-evaluated work</span>.
            </h1>

            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[#9aa3af]">
              SettleNet is a decentralized protocol for posting jobs, staking bonds, and settling
              disputes with AI evaluator agents onchain.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-6">
              {FEATURES.map(({ title, detail, Icon, tone }) => (
                <div key={title} className="min-w-0">
                  <Icon size={18} className={`mb-1.5 sm:mb-2 ${tone}`} />
                  <div className="text-[12px] font-semibold leading-snug sm:text-[14px]">{title}</div>
                  <p className="mt-1 text-[10px] leading-snug text-[#8b949e] sm:text-[12px]">{detail}</p>
                </div>
              ))}
            </div>

            <HeroCtas className="mt-8 hidden lg:flex" onConnect={openConnectModal} />
          </div>

          <div className="min-w-0">
            <DashboardPreview />
            <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[12px] text-[#8b949e]">
              <IconShield size={13} className="text-emerald-400" />
              Secured. Transparent. Built for the agentic future.
            </p>
          </div>

          <HeroCtas className="mt-2 flex lg:hidden" onConnect={openConnectModal} />
        </div>

        <div className="relative z-10 w-full shrink-0 px-4 pb-4 sm:px-10 xl:px-16">
          <div className="grid w-full grid-cols-2 gap-4 rounded-2xl border border-white/[0.08] bg-[#0e1218]/80 px-4 py-4 backdrop-blur-md sm:grid-cols-4 sm:gap-6 sm:px-8 sm:py-5">
            {STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11 ${s.tone}`}>
                  <s.Icon size={17} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-bold tabular-nums leading-tight sm:text-[18px]">{s.value}</div>
                  <div className="truncate text-[11px] text-[#8b949e]">{s.label}</div>
                  <div className="truncate text-[11px] font-medium text-emerald-400">{s.delta}</div>
                </div>
              </div>
            ))}
          </div>
          <a
            href="#built"
            className="mt-4 flex flex-col items-center gap-0.5 pb-1 text-[12px] text-[#8b949e] hover:text-[#c8d0da]"
          >
            <span>Scroll to explore</span>
            <IconChevronDown size={14} className="entrance-bounce opacity-70" />
          </a>
        </div>
      </section>

      <section id="built" className="relative px-4 py-10 sm:px-10 sm:py-14 xl:px-16">
        <h2 className="text-center text-[clamp(1.35rem,3vw,1.55rem)] font-bold tracking-tight">
          Built for trust. Designed for scale.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[13px] text-[#8b949e] sm:text-[14px]">
          Escrow, staked evaluators, and automatic settlement — the full job lifecycle on Arc.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title} className="rounded-2xl border border-white/[0.07] bg-[#10151c] px-5 py-5">
              <span className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${t.tone}`}>
                <t.Icon size={16} />
              </span>
              <div className="text-[15px] font-semibold">{t.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b949e]">{t.detail}</p>
              <ArrowLink
                className={linkCls}
                href={"href" in t ? t.href : undefined}
                onClick={"connect" in t && t.connect ? openConnectModal : undefined}
              >
                {t.link}
              </ArrowLink>
            </div>
          ))}
        </div>
      </section>

      <section className="relative px-4 py-10 sm:px-10 sm:py-14 xl:px-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-sky-500/[0.04] blur-3xl" />
        <h2 className="relative text-center text-[clamp(1.35rem,3vw,1.55rem)] font-bold tracking-tight">
          Powered by Arc
        </h2>
        <p className="relative mx-auto mt-2 max-w-xl text-center text-[13px] text-[#8b949e] sm:text-[14px]">
          Settling on Arc — a stablecoin-native L1 — with open ERC-8004 agent identity.
        </p>
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ECOSYSTEM.map((e) => (
            <div key={e.title} className="rounded-2xl border border-white/[0.07] bg-[#10151c] px-4 py-4">
              <span className={`mb-3 grid h-9 w-9 place-items-center rounded-full ${e.tone}`}>
                <e.Icon size={15} />
              </span>
              <div className="text-[14px] font-semibold">{e.title}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8b949e]">{e.detail}</p>
              <ArrowLink href={e.href} className={ecoLinkCls} iconSize={11}>
                {e.link}
              </ArrowLink>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="relative px-4 py-10 sm:px-10 sm:py-14 xl:px-16">
        <h2 className="text-center text-[clamp(1.35rem,3vw,1.55rem)] font-bold tracking-tight">
          How SettleNet works
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[13px] text-[#8b949e] sm:text-[14px]">
          Four steps from job post to trustless payout — bonds, ratings, and USDC settle onchain.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative text-center lg:px-1 lg:text-left">
              {i < STEPS.length - 1 && (
                <div className="pointer-events-none absolute left-[calc(50%+22px)] top-5 hidden h-px w-[calc(100%-22px)] border-t border-dashed border-white/20 lg:block" />
              )}
              <div className="flex flex-col items-center gap-1.5 lg:items-start">
                <span className={`relative z-[1] grid h-11 w-11 place-items-center rounded-full ${s.tone}`}>
                  <s.Icon size={16} />
                </span>
                <div className="text-[11px] font-medium text-[#6b7280]">{s.n}</div>
                <div className="text-[15px] font-semibold leading-tight">{s.title}</div>
                <p className="max-w-[32ch] text-[13px] leading-relaxed text-[#8b949e] lg:max-w-none">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-4 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 xl:px-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_2fr] lg:gap-8">
          <div>
            <div className="flex items-center gap-2">
              <IconLogoMark size={26} />
              <span className="text-[15px] font-bold">SettleNet</span>
            </div>
            <p className="mt-2.5 max-w-[36ch] text-[13px] leading-relaxed text-[#8b949e]">
              Trustless settlement for agent-evaluated work on Arc.
            </p>
            <div className="mt-4 flex items-center gap-3 text-[#8b949e]">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                  aria-label={s.label}
                >
                  <s.Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-5">
            {FOOTER.map((col) => (
              <div key={col.title}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">{col.title}</div>
                <ul className="mt-2.5 space-y-1.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {"connect" in l && l.connect ? (
                        <button
                          type="button"
                          onClick={openConnectModal}
                          className="text-[13px] text-[#9aa3af] hover:text-white"
                        >
                          {l.label}
                        </button>
                      ) : (
                        <a
                          href={"href" in l ? l.href : undefined}
                          {...("href" in l && isHttp(l.href) ? { target: "_blank", rel: "noreferrer" } : {})}
                          className="text-[13px] text-[#9aa3af] hover:text-white"
                        >
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t border-white/[0.06] pt-5 text-[12px] text-[#6b7280]">
          © {new Date().getFullYear()} SettleNet. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function HeroCtas({ className, onConnect }: { className?: string; onConnect?: () => void }) {
  return (
    <div className={`flex-row flex-wrap items-start gap-3 ${className ?? ""}`}>
      <div className="min-w-0 flex-1 sm:flex-none">
        <button
          type="button"
          onClick={onConnect}
          className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[#10b981] px-4 py-3 text-[13px] font-bold text-[#04140e] shadow-[0_0_36px_rgba(16,185,129,0.32)] hover:brightness-110 sm:min-w-[200px] sm:gap-2.5 sm:px-7 sm:py-3.5 sm:text-[15px]"
        >
          <IconWallet size={16} />
          Connect Wallet
        </button>
        <div className="mt-2 text-center text-[11px] text-[#6b7280] sm:text-[12px]">Connect to get started.</div>
      </div>
      <div className="min-w-0 flex-1 sm:flex-none">
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-[13px] font-semibold text-[#f0f3f6] hover:bg-white/[0.04] sm:min-w-[200px] sm:gap-2.5 sm:px-7 sm:py-3.5 sm:text-[15px]"
        >
          <IconBook size={15} />
          Learn How It Works
        </a>
        <div className="mt-2 text-center text-[11px] text-[#6b7280] sm:text-[12px]">Step-by-step guide.</div>
      </div>
    </div>
  );
}

function DashboardPreview() {
  let acc = 0;
  const stops = DONUT.map((d) => {
    const start = acc;
    acc += d.pct;
    return `${d.color} ${start}% ${acc}%`;
  }).join(", ");
  const totalJobs = STATS[0].value;

  return (
    <div className="entrance-preview w-full overflow-hidden rounded-2xl p-[2px]">
      <div className="overflow-hidden rounded-[14px] bg-[#0b0f15]">
        <div className="flex min-h-[280px] sm:h-[min(48vh,440px)] sm:min-h-[360px]">
          <aside className="hidden w-[148px] shrink-0 flex-col gap-0.5 border-r border-white/[0.06] bg-[#080b10] p-3 sm:flex">
            <div className="mb-2.5 flex items-center gap-1.5 px-1.5 py-1">
              <IconLogoMark size={18} />
              <span className="text-[11px] font-bold">SettleNet</span>
            </div>
            {PREVIEW_NAV.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                  item.active ? "bg-emerald-500/15 font-medium text-emerald-400" : "text-[#8b949e]"
                }`}
              >
                <item.Icon size={13} />
                <span className="truncate">{item.label}</span>
                {item.soon && (
                  <span className="ml-auto rounded bg-amber-500/20 px-1 py-px text-[8px] font-semibold text-amber-400">
                    Soon
                  </span>
                )}
              </div>
            ))}
          </aside>

          <div className="min-w-0 flex-1 overflow-hidden p-3 sm:p-3.5">
            <div className="mb-2 flex items-center justify-between sm:mb-2.5">
              <div className="text-[12px] font-semibold text-[#d1d5db]">Overview</div>
              <div className="flex items-center gap-1.5 sm:hidden">
                <IconLogoMark size={14} />
                <span className="text-[10px] font-bold text-[#8b949e]">SettleNet</span>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATS.map((c) => (
                <div key={c.label} className="rounded-xl border border-white/[0.06] bg-[#12161d] px-2 py-2">
                  <span className={`mb-1.5 grid h-6 w-6 place-items-center rounded-full ${c.tone}`}>
                    <c.Icon size={11} />
                  </span>
                  <div className="truncate text-[9px] text-[#8b949e]">
                    {"short" in c ? c.short : c.label}
                  </div>
                  <div className="truncate text-[13px] font-bold tabular-nums">
                    {"shortValue" in c ? c.shortValue : c.value}
                  </div>
                  <div className="truncate text-[8px] text-emerald-400">{c.delta}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2.5 sm:h-[calc(100%-5.5rem)] sm:grid-cols-[1.15fr_1fr]">
              <div className="rounded-xl border border-white/[0.06] bg-[#12161d] p-2.5">
                <div className="mb-2 text-[11px] font-semibold">Recent Activity</div>
                <ul className="space-y-2">
                  {PREVIEW_ACTIVITY.slice(0, 4).map((a) => (
                    <li key={a.title} className="flex items-center gap-2">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${a.tone}`}>
                        <a.Icon size={11} />
                      </span>
                      <div className="min-w-0 flex-1 truncate text-[10px]">{a.title}</div>
                      <span className="shrink-0 text-[9px] text-[#6b7280]">{a.time}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#12161d] p-2.5">
                <div className="mb-2 text-[11px] font-semibold">Job Status</div>
                <div className="flex items-center gap-3">
                  <div
                    className="relative h-[72px] w-[72px] shrink-0 rounded-full sm:h-[88px] sm:w-[88px]"
                    style={{ background: `conic-gradient(${stops})` }}
                  >
                    <div className="absolute inset-[20%] grid place-items-center rounded-full bg-[#12161d]">
                      <div className="text-center">
                        <div className="text-[14px] font-bold leading-none sm:text-[15px]">{totalJobs}</div>
                        <div className="text-[8px] text-[#8b949e]">Total</div>
                      </div>
                    </div>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1 text-[9px] text-[#9aa3af]">
                    {DONUT.map((d) => (
                      <li key={d.label} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                          {d.label}
                        </span>
                        <span className="tabular-nums text-[#6b7280]">{d.pct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
