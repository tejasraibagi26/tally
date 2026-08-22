"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCents } from "@/lib/money";

export interface NetWorthPoint {
  asOfDate: string;
  net: number;
}

// DESIGN.md §7.2: "Net worth over time" -> single 2px line + 8% area fill, dot on hover. Never bars.
export function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="h-[120px] flex items-center justify-center text-text-3 text-sm">
        Building history — net worth is snapshotted nightly, check back in a few days
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="asOfDate" hide />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: "var(--text-2)" }}
          formatter={(value: number) => [formatCents(value), "Net worth"]}
        />
        <Area type="monotone" dataKey="net" stroke="var(--series-1)" strokeWidth={2} fill="url(#netWorthFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
