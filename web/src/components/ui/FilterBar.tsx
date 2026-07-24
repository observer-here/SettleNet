import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/ui/Icons";

type FilterChip = {
  id: string;
  active: boolean;
  onSelect: () => void;
  content: ReactNode;
};

function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

export function FilterBar({
  items,
  visible = 4,
  className = "mb-1 md:mb-4",
}: {
  items: FilterChip[];
  visible?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const mobile = useMobile();
  const show = mobile ? Math.max(1, visible - 1) : visible;
  const primary = items.slice(0, show);
  const rest = items.slice(show);
  const restActive = rest.find((i) => i.active);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrap} className={`relative flex items-center gap-0.5 md:gap-1.5 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto no-scrollbar md:gap-1.5">
        {primary.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            className={`tab inline-flex shrink-0 items-center gap-1 md:gap-1.5 ${item.active ? "tab-active" : "hover:text-[var(--color-text)]"}`}
          >
            {item.content}
          </button>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`tab inline-flex items-center gap-1 ${restActive ? "tab-active" : "hover:text-[var(--color-text)]"}`}
          >
            {restActive ? restActive.content : "More"}
            <IconChevronDown size={12} className={`opacity-70 transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] py-1 shadow-xl md:left-0 md:right-auto">
              {rest.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs transition hover:bg-white/[0.04] ${
                    item.active
                      ? "bg-[rgba(34,197,94,0.1)] text-[var(--color-accent)]"
                      : "text-[var(--color-text)]"
                  }`}
                >
                  {item.content}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
