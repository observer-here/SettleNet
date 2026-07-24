export function RobotIcon({
  seed,
  size = 48,
  className = "",
}: {
  seed: bigint | number | string;
  size?: number;
  className?: string;
}) {
  const n = typeof seed === "bigint" ? Number(seed % 360n) : Number(seed) % 360;
  const hue = ((n * 47) % 360 + 360) % 360;
  const hue2 = (hue + 40) % 360;
  const id = `rb-${String(seed).replace(/\W/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 70% 48%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2} 65% 32%)`} />
        </linearGradient>
      </defs>
      <rect x="8" y="14" width="48" height="40" rx="10" fill={`url(#${id}-g)`} />
      <rect x="14" y="22" width="36" height="22" rx="6" fill="#0b0e11" opacity="0.85" />
      <circle cx="26" cy="33" r="5" fill={`hsl(${hue} 90% 62%)`} />
      <circle cx="38" cy="33" r="5" fill={`hsl(${hue} 90% 62%)`} />
      <circle cx="26" cy="33" r="2" fill="#04140e" />
      <circle cx="38" cy="33" r="2" fill="#04140e" />
      <rect x="24" y="42" width="16" height="3" rx="1.5" fill={`hsl(${hue} 80% 70%)`} />
      <rect x="28" y="6" width="8" height="10" rx="2" fill={`hsl(${hue2} 55% 40%)`} />
      <circle cx="32" cy="6" r="3.5" fill={`hsl(${hue} 90% 65%)`} />
      <rect x="4" y="28" width="6" height="12" rx="2" fill={`hsl(${hue2} 50% 38%)`} />
      <rect x="54" y="28" width="6" height="12" rx="2" fill={`hsl(${hue2} 50% 38%)`} />
    </svg>
  );
}
