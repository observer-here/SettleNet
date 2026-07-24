type Props = {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  className?: string;
};

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="block">
      <path
        d={dir === "left" ? "M6.2 1.5 2.7 5l3.5 3.5" : "M3.8 1.5 7.3 5l-3.5 3.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CompactPager({ page, pages, onChange, className = "" }: Props) {
  if (pages <= 1) return null;

  const cur = Math.min(Math.max(0, page), pages - 1);
  const atStart = cur === 0;
  const atEnd = cur === pages - 1;
  const active =
    "inline-flex h-6 min-w-6 items-center justify-center tabular-nums font-semibold text-[var(--color-accent)]";
  const idle = "inline-flex h-6 min-w-6 items-center justify-center tabular-nums hover:text-[var(--color-text)]";
  const box =
    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/15 hover:border-white/30 hover:text-[var(--color-text)]";

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-1.5 text-[10px] text-[var(--color-muted)] md:text-xs ${className}`}
      aria-label="Pagination"
    >
      <button type="button" className={atStart ? active : idle} onClick={() => onChange(0)} disabled={atStart}>
        1
      </button>
      {!atStart && (
        <button type="button" className={box} onClick={() => onChange(cur - 1)} aria-label="Previous page">
          <Chevron dir="left" />
        </button>
      )}
      {!atStart && !atEnd && (
        <span className={active} aria-current="page">
          {cur + 1}
        </span>
      )}
      {!atEnd && (
        <button type="button" className={box} onClick={() => onChange(cur + 1)} aria-label="Next page">
          <Chevron dir="right" />
        </button>
      )}
      <button type="button" className={atEnd ? active : idle} onClick={() => onChange(pages - 1)} disabled={atEnd}>
        {pages}
      </button>
    </nav>
  );
}
