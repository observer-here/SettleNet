import { type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { IconBolt, IconCheckCircle, IconX } from "@/components/ui/Icons";
import {
  ACTIVITY_KIND_LINE,
  type ActivityStatus,
  type WalletActivityItem,
} from "@/hooks/useWalletActivity";
import { relativeTime } from "@/utils/format";

export const ACTIVITY_STATUS_UI: Record<
  ActivityStatus,
  { cls: string; Icon: typeof IconCheckCircle }
> = {
  success: { cls: "bg-emerald-500/15 text-[var(--color-accent)]", Icon: IconCheckCircle },
  rejected: { cls: "bg-red-500/15 text-red-300", Icon: IconX },
  info: { cls: "bg-sky-500/15 text-[var(--color-blue)]", Icon: IconBolt },
};

export function WalletActivityRow({
  item,
  statusOpensTx = false,
}: {
  item: WalletActivityItem;
  statusOpensTx?: boolean;
}) {
  const st = ACTIVITY_STATUS_UI[item.status];
  const txUrl = `https://testnet.arcscan.app/tx/${item.tx}`;
  const openTx = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(txUrl, "_blank", "noopener,noreferrer");
  };
  const cls = `panel flex items-center gap-2.5 rounded-lg border-l-[3px] ${ACTIVITY_KIND_LINE[item.kind]} px-2.5 py-2 transition hover:bg-white/[0.03]`;
  const body = (
    <>
      <span className={`icon-chip h-8 w-8 shrink-0 ${item.tone}`}>
        <item.Icon size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-snug">{item.title}</div>
        <div className="truncate text-[11px] text-[var(--color-muted)]">{item.detail}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] text-[var(--color-muted)]">{relativeTime(item.at)}</div>
        {statusOpensTx ? (
          <button
            type="button"
            title="View on ArcScan"
            onClick={openTx}
            className={`mt-0.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition hover:brightness-125 ${st.cls}`}
          >
            <st.Icon size={9} />
            {item.status}
          </button>
        ) : (
          <span
            className={`mt-0.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${st.cls}`}
          >
            <st.Icon size={9} />
            {item.status}
          </span>
        )}
      </div>
    </>
  );

  if (statusOpensTx && item.href) {
    return (
      <li>
        <Link to={item.href} className={cls}>
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <a href={txUrl} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    </li>
  );
}
