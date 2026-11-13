"use client";

import { useState } from "react";
import { formatCents, formatPercent } from "@tally/core/money";
import { cashFlowSummary, trimLeadingEmptyMonths } from "@tally/core/cashFlowMath";

export interface CashFlowMonth {
  month: string;
  income: number;
  spend: number;
  cashFlow: number;
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// Income and saved are masked by the hide-amounts toggle (.money); spend
// stays visible, matching the rest of the app's privacy rules.
function MonthTooltip({ label, income, spend }: { label: string; income: number; spend: number }) {
  const net = income - spend;
  return (
    <div className="bg-raised border border-border rounded-tile px-3 py-2 text-[13.5px] shadow-overlay flex flex-col gap-1 min-w-[170px]">
      <div className="text-text-2">{label}</div>
      <Row color="var(--positive)" label="Income" value={<span className="money text-right">{formatCents(income)}</span>} />
      <Row color="var(--negative)" label="Spend" value={formatCents(spend)} />
      <Row
        color={net >= 0 ? "var(--positive)" : "var(--negative)"}
        label={net >= 0 ? "Saved" : "Overspent"}
        value={<span className="money text-right">{formatCents(Math.abs(net))}</span>}
      />
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-text-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-text font-medium tabular">{value}</span>
    </div>
  );
}

function Legend({ items }: { items: { label: string; swatch: React.CSSProperties }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] box-border" style={i.swatch} />
          <span className="text-text-2">{i.label}</span>
        </span>
      ))}
    </div>
  );
}

// One bar per month for what was kept: green up from zero when income beat
// spend, coral down when it didn't, the amount on each bar and a dashed line
// at the average. The month in progress is hatched ("so far") so a
// half-finished month doesn't read as a drop. Leading empty months are
// dropped, and a headline states the takeaway (average saved, savings rate).
// Drawn in HTML rather than recharts so the amounts can carry .money.
export function CashFlowChart({ months }: { months: CashFlowMonth[] }) {
  const visible = trimLeadingEmptyMonths(months);
  if (visible.length === 0) {
    return <div className="py-10 text-center text-text-3 text-sm">No income or spending yet. Cash flow shows up once transactions sync.</div>;
  }

  const summary = cashFlowSummary(visible);

  return (
    <div className="flex flex-col gap-3">
      {/* Two lines: the figure with its savings-rate chip, then what the
          figure means and the window it covers. */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* money-fit: shrinks to the dots when hidden, so the chip doesn't
              trail a gap the width of the real figure. */}
          <span className="ui-figure text-[26px] font-semibold tracking-[-0.4px] text-text tabular money money-fit">
            <span>
              {summary.avgSaved < 0 ? "−" : ""}
              {formatCents(Math.abs(summary.avgSaved))}
            </span>
          </span>
          {summary.savingsRate != null && (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[12.5px] font-medium ${summary.savingsRate >= 0 ? "bg-positive-subtle text-positive" : "bg-negative-subtle text-negative"}`}
            >
              {formatPercent(summary.savingsRate)} savings rate
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[13.5px] text-text-2">
          <span>{summary.avgSaved < 0 ? "Overspent" : "Saved"} per month on average</span>
          {summary.monthsCounted > 0 && visible.length > 1 && (
            <>
              <span aria-hidden className="h-3 w-px bg-border-strong" />
              <span className="text-text-3">
                Past {summary.monthsCounted} full month{summary.monthsCounted === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
      </div>
      <NetBars months={visible} avgSaved={summary.avgSaved} showAvg={summary.monthsCounted > 1} />
    </div>
  );
}

const CHART_H = 220;
const LABEL_ROOM = 24;

// Bar labels drop the cents: six "$2,070.45"s crowd a narrow card.
function wholeDollars(cents: number): string {
  return "$" + Math.round(Math.abs(cents) / 100).toLocaleString("en-US");
}

function hatch(color: string): React.CSSProperties {
  return {
    background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 34%, transparent) 0 4px, transparent 4px 9px)`,
    border: `1.5px dashed ${color}`,
  };
}

function NetBars({ months, avgSaved, showAvg }: { months: CashFlowMonth[]; avgSaved: number; showAvg: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const nets = months.map((m) => m.income - m.spend);
  const hi = Math.max(0, ...nets, showAvg ? avgSaved : 0);
  const lo = Math.min(0, ...nets, showAvg ? avgSaved : 0);
  const top = LABEL_ROOM;
  const bottom = lo < 0 ? LABEL_ROOM : 0;
  const span = hi - lo || 1;
  const scale = (CHART_H - top - bottom) / span;
  const zeroY = top + hi * scale;
  const avgY = zeroY - avgSaved * scale;
  const last = months.length - 1;
  const anyOver = nets.some((n, i) => n < 0 && i !== last);

  return (
    <div className="flex flex-col gap-2">
      <div className="ui-bleed">
        <div className="relative" style={{ height: CHART_H }} onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 border-t border-border-strong opacity-50" style={{ top: zeroY }} />
          {showAvg && (
            <>
              <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-border-strong" style={{ top: avgY }} />
              <span
                className="absolute right-4 -translate-y-1/2 bg-surface px-1.5 text-[12px] font-semibold text-text-2 flex items-center gap-1"
                style={{ top: avgY }}
              >
                avg{" "}
                <span className="money tabular">
                  {avgSaved < 0 ? "−" : "+"}
                  {formatCents(Math.abs(avgSaved))}
                </span>
              </span>
            </>
          )}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
            {months.map((m, i) => {
              const net = nets[i]!;
              const up = net >= 0;
              const h = Math.max(2, Math.abs(net) * scale);
              const barTop = up ? zeroY - h : zeroY;
              const partial = i === last && months.length > 1;
              const color = up ? "var(--positive)" : "var(--negative)";
              return (
                <div key={m.month} className="relative" onMouseEnter={() => setHover(i)}>
                  <span
                    className={`absolute inset-x-0 text-center text-[12.5px] font-bold tabular ${partial ? "text-text-2" : up ? "text-positive" : "text-negative"}`}
                    style={{ top: up ? barTop - 20 : barTop + h + 4 }}
                  >
                    <span className="money">
                      {up ? "+" : "−"}
                      {wholeDollars(net)}
                    </span>
                  </span>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 box-border"
                    style={{
                      top: barTop,
                      height: h,
                      width: "min(56px, 52%)",
                      borderRadius: up ? "8px 8px 3px 3px" : "3px 3px 8px 8px",
                      ...(partial ? hatch(color) : { background: color }),
                      opacity: hover != null && hover !== i ? 0.55 : 1,
                    }}
                  />
                  {hover === i && (
                    <div className={`absolute z-10 ${i >= months.length / 2 ? "right-1/2" : "left-1/2"}`} style={{ top: Math.max(0, Math.min(barTop, zeroY) - 8) }}>
                      <MonthTooltip label={monthLabel(m.month) + (partial ? " (so far)" : "")} income={m.income} spend={m.spend} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid pt-2" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
          {months.map((m) => (
            <span key={m.month} className="text-center text-[12px] text-text-3">
              {monthLabel(m.month)}
            </span>
          ))}
        </div>
      </div>
      <Legend
        items={[
          { label: "Saved", swatch: { background: "var(--positive)" } },
          ...(anyOver ? [{ label: "Overspent", swatch: { background: "var(--negative)" } }] : []),
          ...(months.length > 1 ? [{ label: "This month so far", swatch: hatch("var(--text-3)") }] : []),
        ]}
      />
    </div>
  );
}
