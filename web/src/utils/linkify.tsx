import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

function splitUrl(raw: string): { url: string; trail: string } {
  const url = raw.replace(/[.,;:!?)]+$/g, "");
  return { url, trail: raw.slice(url.length) };
}

export function linkifyText(text: string): ReactNode {
  if (!text) return text;
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const { url, trail } = splitUrl(raw);
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a
        key={`u${i++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--color-blue)] underline underline-offset-2 hover:opacity-90"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    if (trail) nodes.push(trail);
    last = start + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : nodes;
}
