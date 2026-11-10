"use client";

import { useMemo, useState } from "react";
import { formatCents } from "@tally/core/money";
import { NET_WORTH_RANGES, RANGE_CAPTION, netWorthDelta, sliceNetWorthRange, type NetWorthRange } from "@tally/core/overviewView";
import { Card, CardHeader } from "@/components/ui/Card";
import { NetWorthChart, type NetWorthPoint } from "@/components/charts/NetWorthChart";
import { cn } from "@/lib/cn";

/**
 * The goal view's "Net worth over the year" card: a change chip for the
 * chosen range and a 1M/3M/6M/1Y filter, like mobile's card variant of
 * NetWorthHero. The range only slices the year the page already loaded.
 * `today` is the user's own date (todayInZone).
 */
export function NetWorthRangeCard({ points, netWorth, today }: { points: NetWorthPoint[]; netWorth: number; today: string }) {
  const [range, setRange] = useState<NetWorthRange>("1Y");
  // A range with fewer than two snapshots can't draw a line: show the whole series.
  const visible = useMemo(() => {
    const sliced = sliceNetWorthRange(points, range, today);
    return sliced.length >= 2 ? sliced : points;
  }, [points, range, today]);
  const delta = useMemo(() => netWorthDelta(points, netWorth, range, today), [points, netWorth, range, today]);

  const up = delta?.direction === "up";
  const caption = delta?.since
    ? `Since ${new Date(delta.since + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : RANGE_CAPTION[range];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Net worth over the year"
        action={
          points.length > 1 && (
            <div className="flex gap-1 rounded-full bg-sunken p-[3px]" role="tablist" aria-label="Chart range">
              {NET_WORTH_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium", range === r ? "bg-raised text-text" : "text-text-3 hover:text-text")}
                >
                  {r}
                </button>
              ))}
            </div>
          )
        }
      />
      {/* Fixed height so switching ranges never shifts the chart. */}
      {points.length > 1 && (
        <div className="h-[26px] mt-4 px-5 flex items-center gap-2.5">
          {delta && (
            <>
              <span className={cn("h-[26px] inline-flex items-center rounded-full px-2.5 text-[12.5px] font-semibold tabular", up ? "bg-positive-subtle text-positive" : "bg-negative-subtle text-negative")}>
                {up ? "▲" : "▼"}{" "}
                <span className="money mx-1">
                  {up ? "+" : "−"}
                  {formatCents(delta.cents)}
                </span>
                · {delta.pct}%
              </span>
              <span className="text-[12.5px] text-text-3">{caption}</span>
            </>
          )}
        </div>
      )}
      <div className="min-h-[200px] flex">
        <NetWorthChart points={visible} />
      </div>
    </Card>
  );
}
