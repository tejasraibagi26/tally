"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@tally/core/money";

interface Point {
  asOfDate: string;
  net: number;
}

const RANGES = [
  { key: "3M", days: 92, label: "the past 3 months" },
  { key: "6M", days: 183, label: "the past 6 months" },
  { key: "1Y", days: 366, label: "the past year" },
  { key: "All", days: Infinity, label: "all time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const DAY = 86_400_000;
const LIME = "#c9f26b";

function dollars(cents: number): string {
  return formatCents(Math.round(cents / 100) * 100).replace(/\.00$/, "");
}
/** "$48.9k" for axis labels. */
function compact(cents: number): string {
  const d = cents / 100;
  const abs = Math.abs(d);
  const sign = d < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}
function dateLabel(t: number, withYear = false): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}

/**
 * Net worth over time for the new Now page: one line on real dates, weekly
 * over longer ranges so it reads as a trend rather than every day's noise,
 * a padded scale so small moves don't look like cliffs, and a hover readout.
 */
export function NetWorthTrend({ points, goal }: { points: Point[]; goal: number | null }) {
  const span = points.length > 1 ? (Date.parse(points.at(-1)!.asOfDate) - Date.parse(points[0]!.asOfDate)) / DAY : 0;
  // Offer only the ranges the history can fill (plus the one just past it).
  const offered = RANGES.filter((r, i) => i === 0 || RANGES[i - 1]!.days < span);
  const [range, setRange] = useState<RangeKey>(offered.some((r) => r.key === "1Y") ? "1Y" : offered.at(-1)!.key);
  const active = RANGES.find((r) => r.key === range)!;

  const view = useMemo(() => {
    const end = points.length ? Date.parse(`${points.at(-1)!.asOfDate}T00:00:00Z`) : 0;
    const from = end - active.days * DAY;
    const inRange = points.map((p) => ({ t: Date.parse(`${p.asOfDate}T00:00:00Z`), net: p.net })).filter((p) => p.t >= from);
    // Weekly beyond three months: keep each week's last snapshot, and always the latest.
    let data = inRange;
    if (active.days > 92 && inRange.length > 60) {
      const byWeek = new Map<number, { t: number; net: number }>();
      for (const p of inRange) byWeek.set(Math.floor(p.t / (7 * DAY)), p);
      data = [...byWeek.values()];
      if (data.at(-1)!.t !== inRange.at(-1)!.t) data.push(inRange.at(-1)!);
    }
    if (data.length < 2) return null;

    const values = data.map((d) => d.net);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // Pad by a share of the range, but never less than 2% of the value itself.
    const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 10_000);
    const min = lo - pad;
    let max = hi + pad;
    const goalFits = goal != null && goal >= min && goal <= max + (max - min) * 0.6;
    if (goalFits) max = Math.max(max, goal! + pad * 0.5);

    // Month ticks (or quarter ticks for long ranges).
    const months = (data.at(-1)!.t - data[0]!.t) / (30 * DAY);
    const step = months > 15 ? 3 : months > 6 ? 2 : 1;
    const ticks: number[] = [];
    const first = new Date(data[0]!.t);
    for (let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)); d.getTime() <= data.at(-1)!.t; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step, 1))) {
      ticks.push(d.getTime());
    }
    return { data, min, max, goalFits, ticks, start: data[0]!, last: data.at(-1)! };
  }, [points, active, goal]);

  if (!view) {
    return <p className="tn-muted" style={{ margin: 0 }}>Building history. Net worth is saved nightly, so the line fills in over the next few days.</p>;
  }

  const change = view.last.net - view.start.net;
  const pct = view.start.net !== 0 ? (change / Math.abs(view.start.net)) * 100 : null;
  const up = change >= 0;

  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 15 }}>
          <span className={`money ${up ? "tn-lime" : "tn-coral"}`} style={{ fontWeight: 600 }}>
            {up ? "+" : "−"}
            {dollars(Math.abs(change))}
            {pct != null && Math.abs(pct) < 1000 ? ` (${Math.abs(pct).toFixed(1)}%)` : ""}
          </span>{" "}
          <span className="tn-muted">over {active.label}</span>
        </span>
        <div role="group" aria-label="Range" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: "var(--tn-surface)" }}>
          {offered.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={r.key === range}
              onClick={() => setRange(r.key)}
              style={{
                minHeight: 32,
                padding: "0 12px",
                border: 0,
                borderRadius: 999,
                background: r.key === range ? "var(--tn-ink)" : "none",
                color: r.key === range ? "var(--tn-bg)" : "var(--tn-muted)",
                font: "inherit",
                fontSize: 13,
                fontWeight: r.key === range ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 240 }} role="img" aria-label={`Net worth over ${active.label}: ${dollars(view.start.net)} to ${dollars(view.last.net)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view.data} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#23231f" strokeDasharray="3 6" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={view.ticks}
              tickFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
              tick={{ fill: "#8f8d84", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              orientation="right"
              domain={[view.min, view.max]}
              tickCount={4}
              tickFormatter={compact}
              tick={{ fill: "#8f8d84", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
              allowDataOverflow
            />
            {view.goalFits && (
              <ReferenceLine
                y={goal!}
                stroke="#f2b84b"
                strokeDasharray="6 5"
                strokeWidth={1.5}
                label={{ value: `Goal ${compact(goal!)}`, position: "insideTopLeft", fill: "#f2b84b", fontSize: 12 }}
              />
            )}
            <Tooltip
              cursor={{ stroke: "#4a4a42", strokeWidth: 1 }}
              content={({ active: on, payload }) => {
                const p = on && payload?.[0]?.payload ? (payload[0].payload as { t: number; net: number }) : null;
                if (!p) return null;
                const d = p.net - view.start.net;
                return (
                  <div style={{ background: "#f2f1ea", color: "#11110f", borderRadius: 12, padding: "8px 12px", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
                    <div style={{ color: "#55544d" }}>{dateLabel(p.t, true)}</div>
                    <div className="money" style={{ fontFamily: "var(--font-bricolage)", fontWeight: 700, fontSize: 18 }}>
                      {dollars(p.net)}
                    </div>
                    <div className="money" style={{ color: d >= 0 ? "#3d5a00" : "#a1301f", fontWeight: 600 }}>
                      {d >= 0 ? "+" : "−"}
                      {dollars(Math.abs(d))} since {dateLabel(view.start.t)}
                    </div>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="net" stroke={LIME} strokeWidth={2.5} fill={LIME} fillOpacity={0.07} dot={false} activeDot={{ r: 5, fill: LIME, stroke: "#11110f", strokeWidth: 3 }} isAnimationActive={false} />
            <ReferenceDot x={view.last.t} y={view.last.net} r={5} fill={LIME} stroke="#11110f" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {goal != null && !view.goalFits && goal > view.max && (
        <span className="tn-amber" style={{ fontSize: 13 }}>
          Your goal of <span className="money">{dollars(goal)}</span> is <span className="money">{dollars(goal - view.last.net)}</span> above where you are now.
        </span>
      )}
    </figure>
  );
}
