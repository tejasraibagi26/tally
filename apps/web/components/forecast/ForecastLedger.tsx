import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatCents } from "@tally/core/money";
import type { ForecastDay, ForecastEvent } from "@tally/core/forecast";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
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

function tile(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    day: String(d.getUTCDate()),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
  };
}

/**
 * What's coming, one block per day: a date tile, the day's events, and the
 * balance the day leaves behind.
 *
 * The balance is the day's, so it's written once under the day rather than
 * against one of its rows; a day with only card charges doesn't move cash
 * and has none. A day that ends under the buffer says so beside that balance
 * with an icon and words — never a tinted row (DESIGN.md §7: positive and
 * negative colour amounts, not backgrounds).
 *
 * Every row drills into the thing that produced it (the M6 rule). A bill
 * charged to a credit card is greyed: it reaches cash through that card's
 * payment, not on its own date.
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

  // Anything in the grace window lands on day 0, as it does in the curve.
  const groups: { date: string; events: ForecastEvent[] }[] = [];
  for (const e of shown) {
    const date = e.date < today ? today : e.date;
    const last = groups.at(-1);
    if (last?.date === date) last.events.push(e);
    else groups.push({ date, events: [e] });
  }

  return (
    <div className="flex flex-col">
      {groups.map((g) => {
        const t = tile(g.date);
        const isToday = g.date === today;
        const movesCash = g.events.some((e) => e.affectsCash);
        const after = movesCash ? balanceOn.get(g.date) : undefined;
        const short = after != null && after < cushion;
        return (
          <section key={g.date} className="grid grid-cols-[44px_1fr] gap-x-4 border-b border-border py-3 last:border-b-0">
            <div
              aria-label={isToday ? "Today" : dayLabel(g.date)}
              className={cn(
                "flex h-fit flex-col items-center rounded-control border py-1.5 leading-none",
                isToday ? "border-brand bg-brand-subtle text-brand" : "border-border bg-surface-2 text-text",
              )}
            >
              <span className={cn("text-[10px] font-semibold tracking-wider", !isToday && "text-text-3")}>{isToday ? "TODAY" : t.weekday}</span>
              <span className="money mt-1 text-[18px] font-semibold tabular">{t.day}</span>
              <span className={cn("mt-0.5 text-[10px] font-semibold tracking-wider", !isToday && "text-text-3")}>{t.month}</span>
            </div>

            <div className="flex min-w-0 flex-col">
              {g.events.map((e) => (
                <Link
                  key={`${e.sourceId}-${e.date}-${e.label}`}
                  href={hrefFor(e)}
                  className="-mx-2 grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-2"
                >
                  <MerchantAvatar name={e.label} className={cn("size-7 rounded-[8px] text-[12px]", !e.affectsCash && "opacity-60")} />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("flex min-w-0 items-center gap-2 text-[14px]", e.affectsCash ? "text-text" : "text-text-3")}>
                      <span className="truncate">{e.label}</span>
                      {e.modelled && (
                        <span className="shrink-0 rounded-full border border-dashed border-border-strong px-1.5 py-px text-[11px] font-semibold text-text-3">projected</span>
                      )}
                    </span>
                    {(e.date < today || !e.affectsCash) && (
                      <span className={cn("text-[12px]", e.date < today ? "font-medium text-warning" : "text-text-3")}>
                        {e.date < today ? `Overdue · was ${dayLabel(e.date)}` : "On a card · paid with its statement"}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "money text-right text-[14px] font-semibold tabular",
                      e.amount > 0 ? "text-positive" : e.affectsCash ? "text-negative" : "text-text-3",
                    )}
                  >
                    {formatCents(e.amount, { signed: e.amount > 0 })}
                  </span>
                </Link>
              ))}

              {after != null && (
                <div className="mt-1 flex items-center justify-end gap-2 text-[12.5px]">
                  {short && (
                    <span className="flex items-center gap-1 font-semibold text-negative">
                      <AlertTriangle className="size-3.5" strokeWidth={2.5} aria-hidden />
                      Under your {formatCents(cushion)} buffer
                    </span>
                  )}
                  <span className="text-text-3">Balance after</span>
                  <span className={cn("money font-semibold tabular", after < 0 ? "text-negative" : "text-text")}>{formatCents(after)}</span>
                </div>
              )}
            </div>
          </section>
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
