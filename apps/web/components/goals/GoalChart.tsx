"use client";

import { useMemo } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatCents } from "@tally/core/money";
import { EdgeTick } from "@/components/charts/EdgeTick";

export interface GoalChartPoint {
  date: string;
  /** Net worth so far (cents); absent on the projected stretch. */
  actual?: number;
  /** The projection from today to the deadline; only at its two ends. */
  projected?: number;
}

function shortDate(iso: string): string {
  return shortDateMs(Date.parse(`${iso}T00:00:00Z`));
}

function shortDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Net worth so far (line + area), the projection from today to the
 * deadline (dashed) and the target (a labelled line). Runs edge to edge of
 * its card (the caller wraps it in .ui-bleed); EdgeTick keeps the end
 * labels inside.
 *
 * The x axis is a real time scale, not one slot per point: the projection is
 * a single point months past the last recorded day, and a category axis
 * would give it the same step as one day, squashing the rest of the year
 * into a sliver and spacing the date labels wrong.
 */
export function GoalChart({ points, target }: { points: GoalChartPoint[]; target: number }) {
  const data = useMemo(() => points.map((p) => ({ ...p, t: Date.parse(`${p.date}T00:00:00Z`) })), [points]);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tick={<EdgeTick format={(d) => shortDateMs(Number(d))} />}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis hide domain={[(min: number) => Math.min(min, target) * 0.98, (max: number) => Math.max(max, target) * 1.02]} />
        <Tooltip
          cursor={{ stroke: "var(--text-3)", strokeDasharray: "2 3" }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as GoalChartPoint | undefined) : undefined;
            if (!p) return null;
            const v = p.actual ?? p.projected;
            return (
              <div className="rounded-control border border-border bg-raised shadow-overlay px-3 py-2 text-xs flex flex-col gap-0.5">
                <span className="text-text-3">
                  {shortDate(p.date)} · {p.actual != null ? "net worth" : "projected"}
                </span>
                {v != null && <span className="money tabular text-text">{formatCents(v)}</span>}
              </div>
            );
          }}
        />
        <ReferenceLine y={target} stroke="var(--positive)" strokeWidth={1.5} label={{ value: `Target ${formatCents(target)}`, position: "insideTopLeft", fill: "var(--positive)", fontSize: 11, fontWeight: 600 }} />
        <Area type="monotone" dataKey="actual" stroke="var(--brand)" strokeWidth={2.5} fill="url(#goalFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
        <Line type="linear" dataKey="projected" stroke="var(--brand)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
