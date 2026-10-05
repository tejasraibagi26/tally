"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Minus, Plus, CircleDollarSign, Circle } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { describeInvestmentTxn, type Position, type TxnIcon } from "@tally/core/investments";
import { cn } from "@/lib/cn";
import type { ActivityView } from "@/components/investments/types";

// Pieces shared by the Investments page and the holding side panel.

export function formatQuantity(q: number): string {
  return Number.isInteger(q) ? q.toLocaleString() : q.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function Ticker({ p, size = 34 }: { p: Pick<Position, "ticker" | "isCashEquivalent">; size?: number }) {
  const label = p.isCashEquivalent ? "CASH" : (p.ticker ?? "?").slice(0, 5);
  return (
    <span className="flex-none rounded-[9px] bg-surface-2 text-text-2 font-mono text-[10.5px] font-medium flex items-center justify-center tracking-tight" style={{ width: size, height: size }}>
      {label}
    </span>
  );
}

const ICONS: Record<TxnIcon, typeof Plus> = {
  buy: ArrowDownLeft,
  sell: ArrowUpRight,
  income: CircleDollarSign,
  deposit: Plus,
  withdrawal: Minus,
  transfer: ArrowLeftRight,
  fee: Minus,
  other: Circle,
};
export function ActivityRow({ a, showAccount = true }: { a: ActivityView; showAccount?: boolean }) {
  const d = describeInvestmentTxn(a, (c) => formatCents(c));
  const Icon = ICONS[d.icon];
  return (
    <li className="grid grid-cols-[64px_28px_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-2.5 border-t border-border text-[13.5px]">
      <span className="font-mono text-xs text-text-3">{new Date(`${a.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <span className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", d.tone === "positive" ? "bg-positive-subtle text-positive" : d.tone === "negative" ? "bg-negative-subtle text-negative" : "bg-surface-2 text-text-2")}>
        <Icon size={14} strokeWidth={1.9} />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium text-text truncate">{d.title}</span>
        {d.detail && <span className="text-xs text-text-3 truncate">{d.detail}</span>}
      </span>
      {showAccount ? <span className="text-xs text-text-3 bg-sunken rounded-md px-2 py-0.5 whitespace-nowrap">{a.accountName}</span> : <span />}
      <span className={cn("tabular font-semibold text-right min-w-[90px]", d.tone === "positive" ? "text-positive" : d.tone === "negative" ? "text-negative" : "text-text")}>
        {formatCents(d.amount, { signed: d.signed })}
      </span>
    </li>
  );
}

