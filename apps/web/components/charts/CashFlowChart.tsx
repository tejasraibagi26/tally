"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { formatCents } from "@tally/core/money";

export interface CashFlowMonth {
  month: string;
  income: number;
  spend: number;
  cashFlow: number;
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
}

function CashFlowTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const spend = Math.abs(payload.find((p) => p.dataKey === "spendNegative")?.value ?? 0);
  return (
    <div className="bg-surface border border-border rounded-[8px] px-3 py-2 text-[13px] shadow-raised">
      <div className="text-text-2 mb-1">{label}</div>
      <div className="text-positive">Income {formatCents(income)}</div>
      <div className="text-negative">Spend {formatCents(spend)}</div>
    </div>
  );
}

// DESIGN.md §7.2: "Cash flow by month" -> diverging bars from a zero baseline (income up, spend down). Never stacked, never dual-axis.
export function CashFlowChart({ months }: { months: CashFlowMonth[] }) {
  const data = months.map((m) => ({ ...m, label: monthLabel(m.month), spendNegative: -m.spend }));

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          <Tooltip content={<CashFlowTooltip />} cursor={{ fill: "var(--sunken)" }} />
          <Bar dataKey="income" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="spendNegative" fill="var(--negative)" radius={[0, 0, 3, 3]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-[13px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--positive)" }} />
          <span className="text-text-2">Income</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--negative)" }} />
          <span className="text-text-2">Spend</span>
        </span>
      </div>
    </div>
  );
}
