import { formatUnits } from "viem";
import { USDC_DECIMALS } from "@/config/contracts";

export function formatUsdc(amount: bigint, digits = 2): string {
  const n = Number(formatUnits(amount, USDC_DECIMALS));
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function shortAddr(addr?: string, size = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function timeLeft(expiredAt: bigint, now = Date.now() / 1000): string {
  const left = Number(expiredAt) - now;
  if (left <= 0) return "Expired";
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} left`;
  if (h > 0) return `${h}h left`;
  const m = Math.max(1, Math.floor(left / 60));
  return `${m}m left`;
}

export function formatExpiryAt(expiredAt: bigint): string {
  const d = new Date(Number(expiredAt) * 1000);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(ts: number, now = Date.now() / 1000): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function jobTitle(title?: string | null, description?: string | null): string {
  const t = (title ?? "").trim();
  if (t) return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  const line = (description ?? "").trim().split(/\n/)[0] || "Untitled job";
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

export function asBig(v: unknown, fallback = 0n): bigint {
  if (v === undefined || v === null || v === "") return fallback;
  try {
    return BigInt(v as string | number | bigint);
  } catch {
    return fallback;
  }
}

export function formatScore(tenths: number | bigint): string {
  return (Number(tenths) / 10).toFixed(1);
}
