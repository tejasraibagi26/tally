import Link from "next/link";
import { cn } from "@/lib/cn";

export interface StatTileDelta {
  direction: "up" | "down";
  pctLabel: string; // pre-formatted, e.g. "12%"
  goodDirection: "up" | "down"; // which direction is positive news for this metric
  comparisonLabel: string; // e.g. "vs last month"
}

// DESIGN.md §7.5 stat tile: label + serif number + delta chip + secondary line. The whole tile links to the filtered transaction list that produced the number (WORK.md §9: "if you can't drill into it, don't display it").
export function StatTile({
  label,
  value,
  delta,
  secondary,
  href,
}: {
  label: string;
  value: string;
  delta?: StatTileDelta;
  secondary?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block bg-surface border border-border rounded-card p-5 flex flex-col gap-2 hover:border-border-strong transition-colors">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">{label}</span>
      <span className="font-display text-[32px] leading-none text-text tabular">{value}</span>
      {delta && (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium w-fit px-1.5 py-0.5 rounded-full",
            delta.direction === delta.goodDirection ? "text-positive bg-positive-subtle" : "text-negative bg-negative-subtle",
          )}
        >
          <span aria-hidden>{delta.direction === "up" ? "▲" : "▼"}</span>
          {delta.pctLabel} {delta.comparisonLabel}
        </span>
      )}
      {secondary && <span className="text-xs text-text-2">{secondary}</span>}
    </Link>
  );
}
