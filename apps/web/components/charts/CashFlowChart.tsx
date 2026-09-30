"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents, formatPercent } from "@tally/core/money";
import { cashFlowSummary, trimLeadingEmptyMonths, withCrossings } from "@tally/core/cashFlowMath";

export interface CashFlowMonth {
  month: string;
  income: number;
  spend: number;
  cashFlow: number;
}

// Below this many months with data the line view is just a couple of
// points, so the paired bars read better until there's more history.
const MIN_MONTHS_FOR_LINES = 4;

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// Income and saved are masked by the hide-amounts toggle (.money); spend
// stays visible, matching the rest of the app's privacy rules.
function MonthTooltip({ label, income, spend }: { label: string; income: number; spend: number }) {
  const net = income - spend;
  return (
    <div className="bg-raised border border-border rounded-[8px] px-3 py-2 text-[13px] shadow-overlay flex flex-col gap-1 min-w-[170px]">
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

interface PointPayload {
  payload: { label?: string; income: number; spend: number; crossing?: boolean };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: PointPayload[] }) {
  const point = payload?.[0]?.payload;
  // Inserted crossing points exist only to shade the gap precisely; they
  // aren't a month, so they get no tooltip.
  if (!active || !point || point.crossing || !point.label) return null;
  return <MonthTooltip label={point.label} income={point.income} spend={point.spend} />;
}

function Legend({ items }: { items: { color: string; label: string; swatch?: "dot" | "band" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={i.swatch === "band" ? "w-3 h-2 rounded-[2px]" : "w-2 h-2 rounded-full"} style={{ background: i.color, opacity: i.swatch === "band" ? 0.45 : 1 }} />
          <span className="text-text-2">{i.label}</span>
        </span>
      ))}
    </div>
  );
}

// DESIGN.md §7.2, revised: income and spend as two lines with the gap
// between them shaded green (saved) or red (overspent) once there are
// MIN_MONTHS_FOR_LINES months of data; side-by-side bars from a zero
// baseline before that. Leading empty months are dropped either way, and a
// headline states the takeaway (average saved, savings rate).
export function CashFlowChart({ months }: { months: CashFlowMonth[] }) {
  const visible = trimLeadingEmptyMonths(months);
  if (visible.length === 0) {
    return <div className="py-10 text-center text-text-3 text-sm">No income or spending yet. Cash flow shows up once transactions sync.</div>;
  }

  const summary = cashFlowSummary(visible);
  const useLines = visible.length >= MIN_MONTHS_FOR_LINES;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[26px] font-semibold tracking-[-0.4px] text-text tabular money">
          {summary.avgSaved < 0 ? "−" : ""}
          {formatCents(Math.abs(summary.avgSaved))}
        </span>
        <span className="text-[13.5px] text-text-2">
          {summary.avgSaved < 0 ? "overspent" : "saved"} per month on average
          {summary.monthsCounted > 0 && visible.length > 1 ? ` · past ${summary.monthsCounted} full month${summary.monthsCounted === 1 ? "" : "s"}` : ""}
        </span>
        {summary.savingsRate != null && (
          <span
            className={`money inline-flex px-2 py-0.5 rounded-full text-[12.5px] font-medium ${summary.savingsRate >= 0 ? "bg-positive-subtle text-positive" : "bg-negative-subtle text-negative"}`}
          >
            {formatPercent(summary.savingsRate)} savings rate
          </span>
        )}
      </div>
      {useLines ? <GapLines months={visible} /> : <PairedBars months={visible} />}
    </div>
  );
}

function GapLines({ months }: { months: CashFlowMonth[] }) {
  const data = withCrossings(months).map((p) => ({
    ...p,
    label: p.crossing ? undefined : monthLabel(months[p.x]!.month),
    // Range bands: a zero-height band wherever that side doesn't apply, so
    // each color only fills its own stretches of the gap.
    savedBand: p.income >= p.spend ? [p.spend, p.income] : [p.income, p.income],
    overBand: p.spend > p.income ? [p.income, p.spend] : [p.spend, p.spend],
  }));
  const ticks = months.map((_, i) => i);
  const dot = (color: string) =>
    function DotRenderer(props: { cx?: number; cy?: number; payload?: { crossing?: boolean }; index?: number }) {
      if (props.payload?.crossing || props.cx == null || props.cy == null) return <g key={props.index} />;
      return <circle key={props.index} cx={props.cx} cy={props.cy} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />;
    };

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, months.length - 1]}
            ticks={ticks}
            tickFormatter={(i: number) => monthLabel(months[i]!.month)}
            tick={{ fill: "var(--text-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 4" }} />
          <Area dataKey="savedBand" type="linear" stroke="none" fill="var(--positive)" fillOpacity={0.18} isAnimationActive={false} activeDot={false} />
          <Area dataKey="overBand" type="linear" stroke="none" fill="var(--negative)" fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
          <Line dataKey="spend" type="linear" stroke="var(--negative)" strokeWidth={2.5} dot={dot("var(--negative)")} activeDot={{ r: 4.5 }} isAnimationActive={false} />
          <Line dataKey="income" type="linear" stroke="var(--positive)" strokeWidth={2.5} dot={dot("var(--positive)")} activeDot={{ r: 4.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <Legend
        items={[
          { color: "var(--positive)", label: "Income" },
          { color: "var(--negative)", label: "Spend" },
          { color: "var(--positive)", label: "Saved", swatch: "band" },
          { color: "var(--negative)", label: "Overspent", swatch: "band" },
        ]}
      />
    </div>
  );
}

function PairedBars({ months }: { months: CashFlowMonth[] }) {
  const data = months.map((m) => ({ ...m, label: monthLabel(m.month) }));
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }} barGap={6}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--sunken)" }} />
          <Bar dataKey="income" fill="var(--positive)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          <Bar dataKey="spend" fill="var(--negative)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <Legend
        items={[
          { color: "var(--positive)", label: "Income" },
          { color: "var(--negative)", label: "Spend" },
        ]}
      />
    </div>
  );
}
