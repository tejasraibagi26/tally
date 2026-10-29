import Link from "next/link";
import { formatCents } from "@tally/core/money";
import type { ForecastDay, ForecastEvent } from "@tally/core/forecast";
import { cn } from "@/lib/cn";

/** Where a row goes when you click it: the thing that made it, not this page. */
function hrefFor(e: ForecastEvent): string {
  if (e.kind === "card") return `/cards?card=${e.sourceId}`;
  if (e.kind === "income") return "/settings#income";
  return `/subscriptions?stream=${e.sourceId}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * What's coming, day by day, with the balance each one leaves behind.
 *
 * Every row drills into the thing that produced it (the M6 rule). A bill
 * charged to a credit card is greyed and has no running balance: it reaches
 * cash through that card's payment, not on its own date.
 */
export function ForecastLedger({
  events,
  days,
  cushion,
  limit,
}: {
  events: ForecastEvent[];
  days: ForecastDay[];
  cushion: number;
  limit?: number;
}) {
  const balanceOn = new Map(days.map((d) => [d.date, d.balance]));
  const today = days[0]?.date ?? "";
  const shown = limit ? events.slice(0, limit) : events;
  const hidden = events.length - shown.length;

  // Running balances are per-day, so a row only shows one when it is the
  // last cash event of its day — otherwise two rows would claim the same
  // figure and neither would be wrong, which is worse than one being right.
  const lastCashOfDay = new Map<string, ForecastEvent>();
  for (const e of events) if (e.affectsCash) lastCashOfDay.set(e.date < today ? today : e.date, e);

  let lastDate = "";
  return (
    <div className="flex flex-col">
      {shown.map((e) => {
        const date = e.date < today ? today : e.date;
        const newDay = date !== lastDate;
        lastDate = date;
        const after = lastCashOfDay.get(date) === e ? balanceOn.get(date) : undefined;
        const short = after != null && after < cushion;
        return (
          <div key={`${e.sourceId}-${e.date}-${e.label}`}>
            {newDay && (
              <div className={cn("pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider", short ? "text-negative" : "text-text-3")}>
                {date === today ? "Today" : dayLabel(date)}
                {e.date < today && " · overdue"}
              </div>
            )}
            <Link
              href={hrefFor(e)}
              className={cn(
                "grid grid-cols-[1fr_auto_auto] items-center gap-3.5 border-b border-border py-2.5 text-[14px] hover:bg-surface-2",
                short && "bg-negative-subtle",
              )}
            >
              <span className={cn("flex min-w-0 items-center gap-2", !e.affectsCash && "text-text-3")}>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: e.amount > 0 ? "var(--positive)" : e.kind === "card" ? "var(--status-critical)" : e.affectsCash ? "var(--series-1)" : "var(--border-strong)" }}
                />
                <span className="truncate">{e.label}</span>
                {e.modelled && (
                  <span className="shrink-0 rounded-full border border-dashed border-border-strong px-1.5 py-px text-[11px] font-semibold text-text-3">projected</span>
                )}
                {!e.affectsCash && <span className="shrink-0 text-[12px]">on a card</span>}
              </span>
              <span className={cn("money font-semibold tabular", e.amount > 0 ? "text-positive" : e.affectsCash ? "text-negative" : "text-text-3")}>
                {formatCents(e.amount)}
              </span>
              <span className={cn("money min-w-[82px] text-right text-[13px] tabular", short && "font-semibold", after != null && after < 0 ? "text-negative" : short ? "text-text" : "text-text-3")}>
                {after == null ? "—" : formatCents(after)}
              </span>
            </Link>
          </div>
        );
      })}
      {hidden > 0 && (
        <Link href="/forecast" className="pt-3 text-[13px] font-semibold text-brand">
          + {hidden} more through {dayLabel(days.at(-1)!.date)}
        </Link>
      )}
      {events.length === 0 && (
        <p className="m-0 py-6 text-center text-[13.5px] text-text-2">
          Nothing scheduled in this window. Bills come from Subscriptions and pay dates from your income schedule.
        </p>
      )}
    </div>
  );
}
