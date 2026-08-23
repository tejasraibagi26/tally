"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { formatCents } from "@/lib/money";
import type { ProjectionPoint } from "@/lib/fireMath";

// Same skeleton as components/charts/NetWorthChart.tsx (DESIGN.md §7.2: single 2px line + 8% area fill, no bars),
// plus a dashed reference line at the FIRE number so the target reads against the projected curve.
export function FireProjectionChart({ points, fireNumberValue }: { points: ProjectionPoint[]; fireNumberValue: number }) {
  if (points.length < 2) {
    return <div className="h-[160px] flex items-center justify-center text-text-3 text-sm">Not enough inputs to project a curve</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fireProjectionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="year" tickFormatter={(y: number) => `${y}y`} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: "var(--text-2)" }}
          labelFormatter={(y: number) => `Year ${y}`}
          formatter={(value: number) => [formatCents(value), "Projected value"]}
        />
        <ReferenceLine y={fireNumberValue} stroke="var(--text-3)" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="projectedValue"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill="url(#fireProjectionFill)"
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
