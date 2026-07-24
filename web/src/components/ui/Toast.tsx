import { useSyncExternalStore } from "react";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { Hash } from "viem";
import { wagmiConfig } from "@/config/wagmi";

type ToastTone = "pending" | "success" | "error";

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  leaving?: boolean;
};

let seq = 0;
let items: ToastItem[] = [];
const subs = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  subs.forEach((fn) => fn());
}

function dismiss(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  items = items.map((x) => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== id);
    emit();
  }, 280);
}

function schedule(id: number, ms: number) {
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.set(
    id,
    setTimeout(() => dismiss(id), ms),
  );
}

function upsert(id: number, patch: Omit<ToastItem, "id">) {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) items = [...items.slice(-2), { id, ...patch }];
  else {
    const next = [...items];
    next[i] = { id, ...patch };
    items = next;
  }
  emit();
}

function isTxHash(v: unknown): v is Hash {
  return typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);
}

function errText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "");
  const e = err as { shortMessage?: string; message?: string; details?: string; cause?: unknown };
  const parts = [e.shortMessage, e.message, e.details].filter(Boolean).join(" ");
  return e.cause ? `${parts} ${errText(e.cause)}` : parts;
}

function txFail(err: unknown): { title: string; detail?: string } {
  const raw = errText(err);
  if (/user rejected|user denied|denied transaction signature/i.test(raw)) {
    return { title: "Request rejected" };
  }
  if (/insufficient (funds|balance)|exceeds balance|transfer amount exceeds|ERC20:.*balance/i.test(raw)) {
    return { title: "Insufficient balance", detail: "Wallet USDC is too low for this action" };
  }
  if (/exceeds allowance|insufficient allowance/i.test(raw)) {
    return { title: "Insufficient allowance", detail: "Approve USDC again, then retry" };
  }
  if (/staked|stake|withdraw/i.test(raw) && /insufficient|exceeds|below/i.test(raw)) {
    return { title: "Insufficient staked amount", detail: "Lower the withdraw amount" };
  }
  if (/rate limit|429|too many requests|request is being rate limited/i.test(raw)) {
    return { title: "RPC rate limited", detail: "Wait a few seconds, then retry" };
  }
  if (/Transaction reverted/i.test(raw)) {
    return { title: "Transaction reverted", detail: "Often insufficient balance, stake, or bond" };
  }
  const short =
    (err as { shortMessage?: string })?.shortMessage ||
    (err instanceof Error ? err.message : "Transaction failed");
  return {
    title: "Transaction failed",
    detail: short.length > 110 ? `${short.slice(0, 110)}…` : short,
  };
}

export async function toastTx<T>(
  labels: { action: string; success: string; detail?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const id = ++seq;
  upsert(id, { tone: "pending", title: "Confirm in wallet", detail: labels.action });
  try {
    const res = await fn();
    if (isTxHash(res)) {
      upsert(id, { tone: "pending", title: "Confirming…", detail: labels.action });
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: res,
        pollingInterval: 8_000,
      });
      if (receipt.status === "reverted") throw new Error("Transaction reverted");
    }
    upsert(id, { tone: "success", title: labels.success, detail: labels.detail });
    schedule(id, 3400);
    return res;
  } catch (err) {
    const fail = txFail(err);
    upsert(id, { tone: "error", title: fail.title, detail: fail.detail });
    schedule(id, fail.title === "Request rejected" ? 2800 : 4800);
    throw err;
  }
}

function useToasts() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => items,
  );
}

const TONE: Record<ToastTone, string> = {
  pending: "border-cyan-400/35",
  success: "border-emerald-400/40",
  error: "border-red-400/40",
};

export function ToastHost() {
  const toasts = useToasts();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[48px] z-[80] flex flex-col items-center gap-0.5 px-0.5 md:bottom-5 md:gap-2 md:px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-full max-w-md rounded-md border bg-[var(--color-panel)] md:rounded-xl ${TONE[t.tone]} ${
            t.leaving ? "toast-out" : "toast-in"
          }`}
        >
          <div className="flex items-start gap-1.5 px-1.5 py-1 md:gap-3 md:px-3.5 md:py-3">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-[8px] font-bold tracking-wide md:h-8 md:w-8 md:rounded-lg md:text-[11px] ${
                t.tone === "pending"
                  ? "bg-cyan-400/15 text-cyan-300"
                  : t.tone === "success"
                    ? "bg-emerald-500/15 text-[var(--color-accent)]"
                    : "bg-red-500/15 text-red-300"
              }`}
            >
              {t.tone === "pending" ? "TX" : t.tone === "success" ? "OK" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold tracking-tight">{t.title}</div>
              {t.detail && (
                <div
                  className={`mt-0.5 text-[11px] text-[var(--color-muted)] ${
                    t.tone === "error" ? "whitespace-normal break-words" : "truncate"
                  }`}
                >
                  {t.detail}
                </div>
              )}
            </div>
            <button
              type="button"
              className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
