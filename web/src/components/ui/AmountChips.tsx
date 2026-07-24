const USDC_AMOUNT_CHIPS = [
  { label: "10 USDC", value: "10" },
  { label: "50 USDC", value: "50" },
  { label: "100 USDC", value: "100" },
  { label: "500 USDC", value: "500" },
] as const;

export function AmountChips({
  value,
  onPick,
  options = USDC_AMOUNT_CHIPS,
}: {
  value: string;
  onPick: (v: string) => void;
  options?: readonly { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onPick(o.value)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              on ? "accent-btn" : "ghost-btn text-[var(--color-muted)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
