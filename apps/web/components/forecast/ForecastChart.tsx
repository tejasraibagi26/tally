"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@tally/core/money";
import type { ForecastDay, ForecastEvent } from "@tally/core/forecast";

export interface ForecastChartPoint extends ForecastDay {
  /** [lo, hi] — Recharts draws a band from a two-value Area. */
  range: [number, number];
  events: ForecastEvent[];
}

const SHORT = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Axis money, abbreviated per DESIGN.md §9 — tiles and axes only. The
 * decimal count depends on the largest tick, not on each one: deciding per
 * value put "$7.0K" and "$14K" on the same axis.
 */
function axisMoney(cents: number, maxCents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "−" : "";
  if (abs === 0) return "$0";
  if (maxCents < 1_000_00) return `${sign}$${Math.round(abs / 100)}`;
  return `${sign}$${(abs / 100_000).toFixed(maxCents >= 100_000_00 ? 0 : 1)}K`;
}

/**
 * DESIGN.md §7.2: a balance over time is a single 2px line with an area
 * fill. The band around it is the likely range of day-to-day spending, so
 * the one modelled part of the picture never looks like the known part.
 */
export function ForecastChart({
  points,
  cushion,
  shortfallDate,
}: {
  points: ForecastChartPoint[];
  cushion: number;
  shortfallDate?: string | null;
}) {
  const dip = shortfallDate ? points.find((p) => p.date === shortfallDate) : undefined;
  const banded = points.some((p) => p.lo !== p.balance);
  const peak = Math.max(...points.map((p) => Math.abs(p.hi)), Math.abs(cushion));

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <ComposedChart data={points} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        {/* Horizontal grid only, no vertical lines (DESIGN.md §7.3). */}
        <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={SHORT}
          minTickGap={48}
          tick={{ fill: "var(--text-3)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => axisMoney(v, peak)}
          width={56}
          tick={{ fill: "var(--text-3)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        {/* Zero reads differently from the buffer: one is a fact, one is a choice. */}
        <ReferenceLine y={0} stroke="var(--text-3)" strokeWidth={1} />
        {cushion > 0 && (
          <ReferenceLine
            y={cushion}
            stroke="var(--brand)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            label={{ value: `Buffer ${formatCents(cushion)}`, position: "insideTopRight", fill: "var(--brand)", fontSize: 11, fontWeight: 600 }}
          />
        )}
        {banded && <Area dataKey="range" stroke="none" fill="url(#forecastBand)" isAnimationActive={false} />}
        <Line
          dataKey="balance"
          type="monotone"
          stroke="var(--series-1)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        {dip && <ReferenceDot x={dip.date} y={dip.balance} r={5} fill="var(--status-critical)" stroke="var(--surface)" strokeWidth={2} isFront />}
        <Tooltip
          contentStyle={{
            background: "var(--raised)",
            border: "var(--tooltip-border, 1px solid var(--border))",
            borderRadius: 8,
            fontSize: 13,
            boxShadow: "var(--shadow-overlay)",
          }}
          labelStyle={{ color: "var(--text-2)" }}
          labelFormatter={(date: string) =>
            new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
          }
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]!.payload as ForecastChartPoint;
            return (
              <div className="rounded-control border border-border bg-raised px-3 py-2 text-[13px] shadow-overlay" style={{ border: "var(--tooltip-border, 1px solid var(--border))" }}>
                <div className="text-text-2">
                  {new Date(`${String(label)}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                </div>
                <div className="money font-semibold text-text tabular">{formatCents(p.balance)}</div>
                {p.lo !== p.balance && (
                  <div className="money text-text-3 tabular">
                    {formatCents(p.lo)} to {formatCents(p.hi)}
                  </div>
                )}
                {p.events.map((e) => (
                  <div key={`${e.sourceId}-${e.date}-${e.label}`} className={e.affectsCash ? "text-text-2" : "text-text-3"}>
                    {e.label} <span className="money tabular">{formatCents(e.amount)}</span>
                    {!e.affectsCash && " (on a card)"}
                  </div>
                ))}
              </div>
            );
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
