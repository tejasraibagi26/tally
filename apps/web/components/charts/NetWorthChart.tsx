"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCents } from "@tally/core/money";

export interface NetWorthPoint {
  asOfDate: string;
  net: number;
}

// DESIGN.md §7.2: "Net worth over time" -> single 2px line + area fill, dot on hover. Never bars.
// Rendered full-bleed inside the Overview hero card (no side margins, no
// grid): it fills its parent's width and height, so the parent sizes it.
export function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center text-text-3 text-sm">
        Building history. Net worth is snapshotted nightly, so check back in a few days
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={160}>
      <AreaChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="asOfDate" hide />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "var(--raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, boxShadow: "var(--shadow-overlay)" }}
          labelStyle={{ color: "var(--text-2)" }}
          formatter={(value: number) => [formatCents(value), "Net worth"]}
        />
        <Area type="monotone" dataKey="net" stroke="var(--series-1)" strokeWidth={2.5} fill="url(#netWorthFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
