import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { freshnessStatus } from "@/lib/freshness";
import { cn } from "@/lib/cn";

/**
 * The one page header every (app) screen uses. Default layout: the page
 * title with a muted context line under it (period, counts, sync freshness),
 * and the page's controls on the right -- the primary action, when there is
 * one, last. Passing `eyebrow` + `figure` switches to the headline variant
 * (section label, title, then the one number the page is about), used by
 * Transactions.
 */
export function PageHeader({
  title,
  meta,
  actions,
  eyebrow,
  figure,
  figureContext,
}: {
  title: string;
  /** Short context items, joined with dots. Falsy entries are skipped. */
  meta?: ReactNode[];
  actions?: ReactNode;
  eyebrow?: string;
  figure?: ReactNode;
  figureContext?: ReactNode;
}) {
  const metaItems = (meta ?? []).filter(Boolean);
  const headline = figure != null;

  return (
    <div className={cn("flex flex-wrap justify-between gap-x-6 gap-y-3 flex-none", headline ? "items-end" : "items-center")}>
      <div className={cn("flex flex-col min-w-0", headline ? "gap-1.5" : "gap-1")}>
        {eyebrow && <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-3">{eyebrow}</span>}
        <h1 className="m-0 text-2xl font-semibold text-text leading-tight">{title}</h1>
        {headline && (
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span className="font-display text-[40px] leading-[1.06] text-text tabular">{figure}</span>
            {figureContext && <span className="text-[13.5px] text-text-2 tabular">{figureContext}</span>}
          </div>
        )}
        {metaItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-text-3 tabular">
            {metaItems.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-border-strong" aria-hidden="true" />}
                <span>{item}</span>
              </Fragment>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

const FRESHNESS_DOT = { good: "bg-status-good", warning: "bg-status-warning", serious: "bg-status-serious" } as const;

function agoLabel(date: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * "Synced 4 min ago" for a header's meta line, dot colored by the WORK.md
 * §8.3 freshness contract. Takes the least-recent sync across connections,
 * so it never reads fresher than the stalest data on the page. Renders
 * nothing when nothing has synced yet.
 */
export function SyncFreshness({ syncedAt }: { syncedAt: (Date | null)[] }) {
  const times = syncedAt.filter((d): d is Date => d != null);
  if (times.length === 0) return null;
  const oldest = new Date(Math.min(...times.map((d) => d.getTime())));
  return (
    <span className="inline-flex items-center gap-1.5" title={oldest.toLocaleString()}>
      <span className={cn("w-1.5 h-1.5 rounded-full", FRESHNESS_DOT[freshnessStatus(oldest)])} aria-hidden="true" />
      Synced {agoLabel(oldest)}
    </span>
  );
}

/** ‹ October 2026 › — one bordered control for stepping through months by link. */
export function MonthStepper({ label, prevHref, nextHref }: { label: string; prevHref: string; nextHref: string }) {
  const arrow = "w-[30px] h-full flex items-center justify-center text-text-2 hover:text-text hover:bg-sunken";
  return (
    <div className="inline-flex items-center h-[30px] rounded-control border border-border-strong bg-surface overflow-hidden">
      <Link href={prevHref} aria-label="Previous month" title="Previous month" className={arrow}>
        ‹
      </Link>
      <span className="h-full px-3 flex items-center border-x border-border text-sm font-medium text-text tabular whitespace-nowrap">{label}</span>
      <Link href={nextHref} aria-label="Next month" title="Next month" className={arrow}>
        ›
      </Link>
    </div>
  );
}
