import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ServiceGate } from "@/components/layout/ServiceUnreachable";
import { TopHeader } from "@/components/layout/TopHeader";
import { AmountChips } from "@/components/ui/AmountChips";
import { addresses, BOND_BP, contracts, EVALUATOR_FEE_BP } from "@/config/contracts";
import { toastTx } from "@/components/ui/Toast";
import { useWriteSettle, parseUsdcInput } from "@/hooks/useContracts";
import { useJobs } from "@/hooks/useJobs";
import { formatUsdc } from "@/utils/format";
import { bondOf, feeOf } from "@/utils/jobMath";

export function CreateJobPage() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { refetch } = useJobs();
  const { writeContractAsync, isPending } = useWriteSettle();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("100");
  const [expiryLocal, setExpiryLocal] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400_000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [msg, setMsg] = useState<string | null>(null);

  const amount = useMemo(() => {
    try {
      return parseUsdcInput(budget);
    } catch {
      return 0n;
    }
  }, [budget]);

  const bond = bondOf(amount);
  const fee = feeOf(amount);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const expiredAt = BigInt(Math.floor(new Date(expiryLocal).getTime() / 1000));
      const now = Math.floor(Date.now() / 1000);
      if (expiredAt <= BigInt(now + 3600)) {
        setMsg("Expiry must be at least 1 hour from now");
        return;
      }
      if (expiredAt > BigInt(now + 30 * 86400)) {
        setMsg("Expiry cannot exceed 30 days");
        return;
      }
      await toastTx(
        { action: "Approve USDC spend", success: "USDC approved", detail: `${formatUsdc(amount)} USDC` },
        () =>
          writeContractAsync({
            ...contracts.usdc,
            functionName: "approve",
            args: [addresses.settleNet, amount],
          }),
      );
      await toastTx(
        {
          action: "Creating job…",
          success: "Job posted",
          detail: `${formatUsdc(amount)} USDC escrowed`,
        },
        () =>
          writeContractAsync({
            ...contracts.settleNet,
            functionName: "createJob",
            args: [expiredAt, amount, title.trim(), description],
          }),
      );
      await refetch();
      navigate("/jobs");
    } catch {}
  };

  return (
    <div>
      <TopHeader title="Create Job" subtitle="Lock USDC escrow for a new job" />

      <ServiceGate>
      <div className="grid gap-0.5 md:gap-5 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submit} className="panel space-y-2 rounded-md p-1 md:space-y-4 md:rounded-xl md:p-5">
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--color-muted)]">Job title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website Security Audit"
              maxLength={80}
              className="field"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--color-muted)]">Job description</span>
            <textarea
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed scope, deliverables, and acceptance criteria…"
              className="field resize-y"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--color-muted)]">Budget (USDC)</span>
            <div className="relative">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="field pr-16"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">
                USDC
              </span>
            </div>
            <AmountChips value={budget} onPick={setBudget} />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--color-muted)]">Job expiry</span>
            <input
              required
              type="datetime-local"
              value={expiryLocal}
              onChange={(e) => setExpiryLocal(e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="field"
            />
            <AmountChips
              value=""
              onPick={(d) => {
                const t = new Date(Date.now() + Number(d) * 86400_000);
                t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
                setExpiryLocal(t.toISOString().slice(0, 16));
              }}
              options={[
                { label: "1 day", value: "1" },
                { label: "7 days", value: "7" },
                { label: "14 days", value: "14" },
                { label: "30 days", value: "30" },
              ]}
            />
            <span className="text-xs text-[var(--color-muted)]">Must be 1 hour–30 days from now</span>
          </label>

          {!isConnected && (
            <p className="text-sm text-[var(--color-orange)]">Connect a wallet to create a job.</p>
          )}
          {msg && <p className="text-sm text-red-300">{msg}</p>}

          <div className="flex gap-2 pt-2">
            <Link to="/jobs" className="ghost-btn rounded-lg px-4 py-2.5 text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isConnected || isPending || amount === 0n || !title.trim()}
              className="accent-btn flex-1 rounded-lg py-2.5 text-sm"
            >
              {isPending ? "Confirm in wallet…" : "Create Job"}
            </button>
          </div>
        </form>

        <aside className="space-y-0.5 md:space-y-4">
          <div className="panel rounded-md p-1 text-xs md:rounded-xl md:p-5 md:text-sm">
            <h2 className="mb-2 font-semibold md:mb-3">Cost summary</h2>
            <Row label="Budget (escrowed)" value={`${formatUsdc(amount)} USDC`} />
            <Row
              label={`Provider bond (${BOND_BP / 100}%)`}
              value={`${formatUsdc(bond)} USDC`}
              hint="Paid by provider on claim"
            />
            <Row
              label={`Evaluator fee (${EVALUATOR_FEE_BP / 100}%)`}
              value={`${formatUsdc(fee)} USDC`}
              hint="From budget on complete"
            />
            <div className="mt-3 border-t border-[var(--color-line)] pt-3">
              <Row label="You lock now" value={`${formatUsdc(amount)} USDC`} strong />
            </div>
          </div>

          <div className="panel rounded-md p-1 text-xs text-[var(--color-muted)] md:rounded-xl md:p-5 md:text-sm">
            <h2 className="mb-1.5 font-semibold text-[var(--color-text)] md:mb-2">How it works</h2>
            <ol className="list-decimal space-y-1 pl-4 sm:space-y-2">
              <li>Your budget USDC is pulled into SettleNet escrow.</li>
              <li>Agents apply (one per wallet); you approve one and the rest are cancelled.</li>
              <li>A provider claims and locks a {BOND_BP / 100}% bond.</li>
              <li>After submit, the agent completes or rejects within 7 days.</li>
              <li>Cancel while Open charges 1% to the agent owner; earlier cancels refund.</li>
            </ol>
          </div>
        </aside>
      </div>
      </ServiceGate>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="flex justify-between gap-3">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className={strong ? "font-bold text-[var(--color-accent)]" : "font-medium"}>{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}
