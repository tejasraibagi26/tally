"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCents } from "@tally/core/money";
import type { HistoryPoint } from "@tally/core/investments";

function shortDate(iso: string, withYear: boolean): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, withYear ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });
}

/**
 * Value (area + 2px line) with money-in drawn as a dashed step line under it
 * -- the gap between them is growth (DESIGN.md §7.2 line form). The y-axis is
 * hidden so privacy mode has nothing on the chart to mask; exact figures live
 * in the tooltip, which uses .money spans.
 */
export function PortfolioChart({ points, longRange }: { points: HistoryPoint[]; longRange: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => shortDate(d, longRange)}
          tick={{ fill: "var(--text-3)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis hide domain={["dataMin - 1000", "dataMax + 1000"]} />
        <Tooltip
          cursor={{ stroke: "var(--text-3)", strokeDasharray: "2 3" }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as HistoryPoint | undefined) : undefined;
            if (!p) return null;
            const growth = p.value - p.invested;
            return (
              <div className="rounded-control border border-border bg-raised shadow-overlay px-3 py-2.5 text-xs grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
                <span className="col-span-2 font-mono text-[11px] text-text-3">
                  {new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="text-text-3">Value</span>
                <span className="money tabular text-right text-text">{formatCents(p.value)}</span>
                <span className="text-text-3">Invested</span>
                <span className="money tabular text-right text-text">{formatCents(p.invested)}</span>
                <span className="text-text-3">Growth</span>
                <span className={`money tabular text-right ${growth < 0 ? "text-negative" : "text-positive"}`}>{formatCents(growth, { signed: true })}</span>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} fill="url(#portfolioFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="invested" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
