"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@tally/core/money";
import { budgetRowState, groupBudgets, monthSummary, type LabelTone, type MonthContext } from "@tally/core/budgetView";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { BudgetPanel } from "@/components/budgets/BudgetPanel";
import type { BudgetLine, UnbudgetedSpend } from "@/lib/budgets";

export interface SetupSummary {
  copy: { fromMonth: string; count: number; total: number } | null;
  average: { count: number; total: number } | null;
}

const toneClass: Record<LabelTone, string> = {
  default: "text-text-2",
  warning: "text-warning",
  negative: "text-negative",
  positive: "text-positive",
  muted: "text-text-3",
};

function fmt(c: number) {
  return formatCents(c).replace(/\.00$/, "");
}

function monthName(month: string, withYear = false) {
  return new Date(`${month}T00:00:00`).toLocaleDateString(undefined, withYear ? { month: "long", year: "numeric" } : { month: "long" });
}

/**
 * The Budgets page body: left-to-spend summary, rows grouped by parent
 * category with a pace tick, the "Not budgeted" row, suggestions, and the
 * budget side panel. Every row's color/label comes from
 * @tally/core/budgetView -- the same rules mobile renders.
 */
export function BudgetsView({
  month,
  ctx,
  budgets,
  unbudgeted,
  setup,
}: {
  month: string;
  ctx: MonthContext;
  budgets: BudgetLine[];
  unbudgeted: UnbudgetedSpend[];
  setup: SetupSummary | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (budgets.length === 0) {
    return <SetupCard month={month} ctx={ctx} setup={setup} unbudgeted={unbudgeted} />;
  }

  const summary = monthSummary(budgets, ctx);
  const groups = groupBudgets(budgets);
  const unbudgetedTotal = unbudgeted.reduce((s, u) => s + u.spend, 0);
  const open = budgets.find((b) => b.categoryId === openId) ?? null;

  // Up to three nudges from data already on the page.
  const nudges: { text: string; action: string; run: () => void }[] = [];
  if (ctx.phase === "current") {
    for (const b of budgets) {
      const s = budgetRowState(b, ctx, fmt);
      if (s.barTone === "warning" && ctx.daysElapsed != null && ctx.daysInMonth != null && ctx.daysElapsed < ctx.daysInMonth * 0.6) {
        nudges.push({ text: `${b.categoryName} is ${Math.round((b.spend / s.available) * 100)}% used on day ${ctx.daysElapsed}`, action: "See", run: () => setOpenId(b.categoryId) });
      }
    }
  }
  const topUnbudgeted = unbudgeted[0];
  if (topUnbudgeted && topUnbudgeted.spend >= 2500) {
    nudges.push({ text: `${topUnbudgeted.categoryName} has ${fmt(topUnbudgeted.spend)} with no budget`, action: "Add", run: () => addBudgetFor(topUnbudgeted) });
  }

  async function addBudgetFor(u: UnbudgetedSpend) {
    setBusy(u.categoryId);
    try {
      // Starts at this month's spend rounded up to $10; the panel opens to adjust it.
      const amount = Math.max(1000, Math.ceil(u.spend / 1000) * 1000);
      const res = await fetch("/api/budgets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, categoryId: u.categoryId, amount }) });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
      setOpenId(u.categoryId);
    } catch {
      setToast({ text: "Couldn't add that budget. Try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2 overflow-hidden">
          {groups.map((g, gi) => (
            <section key={g.name} className={cn(gi > 0 && "border-t border-border")}>
              <div className="flex items-center justify-between px-5 pt-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                <h2 className="m-0 text-[11px] font-semibold">{g.name}</h2>
                <span className="tabular normal-case tracking-normal font-medium text-xs">
                  {fmt(g.spent)} of {fmt(g.budgeted)}
                </span>
              </div>
              {g.lines.map((b) => (
                <BudgetBar key={b.categoryId} line={b} ctx={ctx} onOpen={() => setOpenId(b.categoryId)} />
              ))}
            </section>
          ))}
          {unbudgeted.length > 0 && (
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-border bg-sunken">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[14px] text-text-2">
                  Not budgeted · {unbudgeted.length} {unbudgeted.length === 1 ? "category" : "categories"}
                </span>
                <span className="text-xs text-text-3 truncate">{unbudgeted.slice(0, 4).map((u) => `${u.categoryName} ${fmt(u.spend)}`).join(" · ")}</span>
              </div>
              <span className="tabular text-[14px] text-text">{fmt(unbudgetedTotal)}</span>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-2">
            {ctx.phase === "past" ? (
              <>
                <span className="text-xs font-medium uppercase tracking-wide text-text-3">{monthName(month)} · finished</span>
                <span className={cn("font-display text-[40px] leading-none tabular", summary.left < 0 ? "text-negative" : "text-positive")}>
                  {fmt(Math.abs(summary.left))} {summary.left < 0 ? "over" : "under"}
                </span>
                <span className="text-[13px] text-text-2">
                  {fmt(summary.spent)} of {fmt(summary.budgeted)}
                  {summary.overCount > 0 && ` · ${summary.overCount} budget${summary.overCount === 1 ? "" : "s"} went over`}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-medium uppercase tracking-wide text-text-3">{summary.left < 0 ? "Over budget" : "Left to spend"}</span>
                <span className={cn("font-display text-[40px] leading-none tabular", summary.left < 0 ? "text-negative" : "text-text")}>{fmt(Math.abs(summary.left))}</span>
                <span className="text-[13px] text-text-2">
                  {summary.perDay != null ? `About ${fmt(summary.perDay)} a day for ${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"}` : ctx.phase === "future" ? "Budget for the month" : "Nothing left this month"}
                </span>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 mt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-text-3">Spent</span>
                    <span className="tabular font-semibold text-text">{fmt(summary.spent)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-text-3">Budgeted</span>
                    <span className="tabular font-semibold text-text">{fmt(summary.budgeted)}</span>
                  </div>
                </div>
              </>
            )}
          </Card>
          {nudges.length > 0 && (
            <Card className="p-5 flex flex-col gap-1">
              <h2 className="m-0 mb-1 text-[15px] font-semibold text-text">Worth a look</h2>
              {nudges.slice(0, 3).map((n, i) => (
                <div key={i} className={cn("flex items-center justify-between gap-3 py-2 text-[13px] text-text-2", i > 0 && "border-t border-border")}>
                  <span>{n.text}</span>
                  <button type="button" onClick={n.run} disabled={busy !== null} className="text-brand font-medium hover:underline disabled:opacity-50">
                    {n.action}
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      <BudgetPanel
        month={month}
        line={open}
        onClose={() => setOpenId(null)}
        onRemoved={(undo) => {
          setOpenId(null);
          setToast({ text: `${open?.categoryName ?? "Budget"} removed`, undo });
        }}
      />

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-40 flex items-center gap-4 rounded-control bg-raised border border-border shadow-overlay px-4 py-2.5 text-[13.5px] text-text">
          {toast.text}
          {toast.undo && (
            <button
              type="button"
              className="text-brand font-medium"
              onClick={async () => {
                const undo = toast.undo!;
                setToast(null);
                await undo();
                router.refresh();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}

function BudgetBar({ line, ctx, onOpen }: { line: BudgetLine; ctx: MonthContext; onOpen: () => void }) {
  const s = budgetRowState(line, ctx, fmt);
  const color = s.barTone === "warning" ? "var(--warning)" : `var(--series-${line.colorSlot})`;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left px-5 py-3 flex flex-col gap-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info">
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-none" style={{ background: `var(--series-${line.colorSlot})` }} />
          <span className="text-[14.5px] text-text truncate">{line.categoryName}</span>
          {line.isFixedAmount && <span className="flex-none rounded-full bg-surface-2 px-2 py-px text-[11px] font-medium text-text-2">Fixed</span>}
        </span>
        <span className="text-[13px] tabular whitespace-nowrap text-text-3">
          {fmt(line.spend)} of {fmt(s.available)} · <span className={cn("font-semibold", toneClass[s.labelTone] === "text-text-2" ? "text-text" : toneClass[s.labelTone])}>{s.label}</span>
        </span>
      </span>
      <span className="relative h-2 rounded-full bg-sunken flex overflow-hidden" aria-hidden="true">
        <span className="h-full" style={{ width: `${s.fillPct * 100}%`, background: color }} />
        {s.overPct > 0 && <span className="h-full bg-negative" style={{ width: `${s.overPct * 100}%` }} />}
        {s.pacePct != null && <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-text opacity-50" style={{ left: `${s.pacePct * 100}%` }} title="Where you'd be at an even pace" />}
      </span>
      {(s.note || line.rolloverFromPrior > 0) && (
        <span className="flex justify-between text-xs">
          <span className="text-text-3">{line.rolloverFromPrior > 0 ? `+ ${fmt(line.rolloverFromPrior)} rolled over` : ""}</span>
          {s.note && <span className={toneClass[s.noteTone]}>{s.note}</span>}
        </span>
      )}
    </button>
  );
}

function SetupCard({ month, ctx, setup, unbudgeted }: { month: string; ctx: MonthContext; setup: SetupSummary | null; unbudgeted: UnbudgetedSpend[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"copy" | "average" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(source: "copy" | "average") {
    setBusy(source);
    setError(null);
    try {
      const res = await fetch("/api/budgets/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, source }) });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      setError("Couldn't set up this month. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const spent = unbudgeted.reduce((s, u) => s + u.spend, 0);
  return (
    <Card className="p-8 flex flex-col items-start gap-4 max-w-[560px]">
      <h2 className="m-0 font-display text-[28px] font-normal text-text">Set up {monthName(month)}</h2>
      <p className="m-0 text-[15px] leading-relaxed text-text-2">
        {setup?.copy || setup?.average ? "Start from what you did before. You can adjust any amount after." : "Add a budget for a category to start tracking spending against a limit."}
        {ctx.phase !== "future" && spent > 0 && ` You've spent ${fmt(spent)} so far this month.`}
      </p>
      {setup?.copy && (
        <button type="button" onClick={() => run("copy")} disabled={busy !== null} className="h-11 px-5 rounded-full bg-brand text-on-brand font-semibold text-[14px] disabled:opacity-60">
          {busy === "copy" ? "Copying…" : `Copy ${monthName(setup.copy.fromMonth)} · ${setup.copy.count} budgets, ${fmt(setup.copy.total)}`}
        </button>
      )}
      {setup?.average && (
        <button type="button" onClick={() => run("average")} disabled={busy !== null} className="h-10 px-5 rounded-full bg-brand-subtle text-brand font-semibold text-[14px] disabled:opacity-60">
          {busy === "average" ? "Setting up…" : `Use 3-month averages · ${fmt(setup.average.total)}`}
        </button>
      )}
      {error && <span className="text-[13px] text-negative">{error}</span>}
    </Card>
  );
}
