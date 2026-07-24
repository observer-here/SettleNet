import type { ReactNode } from "react";

type IconProps = { className?: string; size?: number };

function Svg({
  children,
  className = "",
  size = 18,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconLayout(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  );
}

export function IconBriefcase(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 19a5 5 0 0 1 5.5-4.8" />
    </Svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Svg>
  );
}

export function IconCoin(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c.6-1 1.5-1.5 2.5-1.5s2 .7 2 2-1 1.7-2.5 2.2-2.5 1-2.5 2.3 1.1 2 2.5 2 2-.6 2.5-1.5" />
    </Svg>
  );
}

export function IconUsdc({ className = "", size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        fill="#fff"
        d="M20.5 18.135c0 2.022-1.206 3.13-3.683 3.41v2.705h-1.668v-2.646c-2.654-.298-4.365-1.816-4.525-4.21h2.716c.14 1.327 1.057 1.95 2.64 1.95.934 0 1.923-.28 1.923-1.274 0-.7-.466-1.071-2.125-1.46-2.41-.513-4.607-1.142-4.607-3.832 0-1.95 1.274-3.2 3.543-3.48V7.75h1.668v2.66c2.345.326 3.85 1.746 3.973 3.995h-2.66c-.187-1.14-.98-1.746-2.327-1.746-1.134 0-1.855.42-1.855 1.18 0 .77.56 1.087 2.275 1.507 2.52.583 4.445 1.274 4.445 3.79z"
      />
    </svg>
  );
}

export function IconCheckCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3z" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h12" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </Svg>
  );
}

export function IconDoc(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </Svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m7 7 10 10M17 7 7 17" />
    </Svg>
  );
}

export function IconArrowUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

export function IconArrowDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}

export function IconPower(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2v10" />
      <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
    </Svg>
  );
}

export function IconSend(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
  );
}

export function IconBolt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l1-6z" />
    </Svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
      <path d="M16 12h5v2.5A1.5 1.5 0 0 1 19.5 16H16a2 2 0 0 1 0-4z" />
      <circle cx="17.5" cy="14" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v5c0 4.5 2.9 7.9 7 9 4.1-1.1 7-4.5 7-9V6l-7-3z" />
      <path d="m9.5 12 1.8 1.8 3.7-3.8" />
    </Svg>
  );
}

export function IconRobotHead(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="8" width="14" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M10 16h4" />
      <path d="M3 12h2M19 12h2" />
    </Svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Svg>
  );
}

export function IconGithub(p: IconProps) {
  return (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" className={p.className} aria-hidden fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.2-1.12-1.52-1.12-1.52-.92-.64.07-.63.07-.63 1.02.07 1.56 1.07 1.56 1.07.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.32.1-2.75 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.43.2 2.49.1 2.75.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .26.18.59.69.48A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}

export function IconTwitterX(p: IconProps) {
  return (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" className={p.className} aria-hidden fill="currentColor">
      <path d="M18.9 2H21l-6.56 7.5L22 22h-6.2l-4.86-6.35L5.4 22H3.28l7.02-8.02L2 2h6.36l4.4 5.83L18.9 2zm-1.1 18h1.72L7.3 3.9H5.46L17.8 20z" />
    </svg>
  );
}

export function IconDiscord(p: IconProps) {
  return (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" className={p.className} aria-hidden fill="currentColor">
      <path d="M19.27 5.33A16.6 16.6 0 0 0 15.2 4.3l-.2.37a14.6 14.6 0 0 1 5.4 2.7 15.1 15.1 0 0 0-12.8 0 14.5 14.5 0 0 1 5.3-2.7l-.18-.36A16.5 16.5 0 0 0 4.7 5.33C2.1 9.18 1.4 12.92 1.75 16.6a16.7 16.7 0 0 0 5.05 2.56l.65-.9a10.7 10.7 0 0 1-1.03-.5l.25-.2c2.72 1.27 5.68 1.27 8.36 0l.26.2c-.33.2-.67.36-1.03.5l.65.9a16.6 16.6 0 0 0 5.05-2.56c.45-4.25-.66-7.95-2.7-11.27zM8.7 14.3c-.82 0-1.5-.76-1.5-1.7s.66-1.7 1.5-1.7 1.52.76 1.5 1.7-.66 1.7-1.5 1.7zm6.6 0c-.82 0-1.5-.76-1.5-1.7s.66-1.7 1.5-1.7 1.52.76 1.5 1.7-.68 1.7-1.5 1.7z" />
    </svg>
  );
}

export function IconLogoMark({ className = "", size = 32 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="sn-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#sn-logo)" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="#04140e"
        fontFamily="Syne, sans-serif"
        fontWeight="800"
        fontSize="16"
      >
        S
      </text>
    </svg>
  );
}

export function TvlSparkline({
  className = "",
  points = [],
}: {
  className?: string;
  points?: { t: number; v: number }[];
}) {
  const W = 120;
  const H = 36;
  const pad = 2;
  const series =
    points.length >= 2
      ? points
      : points.length === 1
        ? [
            { t: points[0].t - 1, v: points[0].v },
            points[0],
          ]
        : [
            { t: 0, v: 0 },
            { t: 1, v: 0 },
          ];
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const maxV = Math.max(...series.map((p) => p.v), 1e-9);
  const xy = (p: { t: number; v: number }) => {
    const x = pad + ((p.t - t0) / span) * (W - pad * 2);
    const y = H - pad - (p.v / maxV) * (H - pad * 2 - 4);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const line = series.map((p, i) => `${i ? "L" : "M"}${xy(p)}`).join(" ");
  const area = `${line} L${W - pad} ${H} L${pad} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="tvl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tvl-fill)" />
      <path
        d={line}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
