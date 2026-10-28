"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { safeToSpendLine } from "@tally/core/safeToSpend";
import type { SafeToSpendResult } from "@/lib/safeToSpend";
import { SidePanel } from "@/components/ui/SidePanel";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/cn";

const fmt = (c: number) => formatCents(c);

/** A figure masked by "hide amounts" inline (safe to spend is built from balances, like net worth). */
function M({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("money money-fit", className)}>
      <span>{fmt(cents)}</span>
    </span>
  );
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function syncedAgo(iso: string | null): string {
  if (!iso) return "hasn't synced yet";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "last synced over a day ago";
  return `last synced ${days === 1 ? "a day" : `${days} days`} ago`;
}

/** Where the cash goes, as one meter: bills, card payments, cushion, then what's safe. */
function Meter({ s, legend = true }: { s: SafeToSpendResult; legend?: boolean }) {
  const total = Math.max(s.cashTotal, s.billsTotal + s.cardsTotal + s.cushion, 1);
  const parts = [
    { key: "bills", label: "Bills", cents: s.billsTotal, color: "var(--text)" },
    { key: "cards", label: "Cards", cents: s.cardsTotal, color: "var(--border-strong)" },
    { key: "cushion", label: "Cushion", cents: s.cushion, color: "var(--brand-border)" },
    { key: "safe", label: "Safe", cents: Math.max(0, s.amount), color: "var(--marigold, var(--positive))" },
  ].filter((p) => p.cents > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="ui-meter flex h-3 rounded-full overflow-hidden bg-surface border-2 border-[var(--ink,var(--border-strong))]" role="img" aria-label={parts.map((p) => `${p.label} ${fmt(p.cents)}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${(p.cents / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-2">
          {parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] border border-[var(--ink,transparent)]" style={{ background: p.color }} aria-hidden="true" />
              {p.label}
              {p.key !== "safe" && <M cents={p.cents} />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Line({ s }: { s: SafeToSpendResult }) {
  const l = safeToSpendLine(s, fmt);
  return (
    <p className={cn("m-0 text-[14px] leading-snug", l.short ? "text-text" : "text-text-2")}>
      {l.before}
      <b className="font-semibold text-text">{l.emphasis}</b>
      {l.after}
    </p>
  );
}

/**
 * Overview's Safe to spend card (Tally Pop only) and its breakdown panel
 * (?safe=1), from lib/safeToSpend.ts. The card shares the right-hand column
 * with the on-pace card, both at equal height (the Safe to Spend spec,
 * option B).
 */
export function SafeToSpendCard({ s, className }: { s: SafeToSpendResult; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("safe")) setOpen(true);
  }, []);
  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("safe", "1");
    else params.delete("safe");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);

  const short = s.amount < 0;
  return (
    <>
      <button
        type="button"
        onClick={() => toggle(true)}
        className={cn(
          "text-left rounded-card border border-border shadow-raised p-5 flex flex-col gap-2 hover:brightness-[0.98]",
          short ? "bg-negative-subtle" : "bg-brand-subtle",
          className,
        )}
      >
        <span className="flex items-center justify-between w-full">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-text">Safe to spend</span>
          <ChevronRight size={18} strokeWidth={2.2} className="text-text" aria-hidden="true" />
        </span>
        <span className={cn("font-display text-[40px] leading-none tabular", short ? "text-negative" : "text-text")}>
          <M cents={s.amount} />
        </span>
        <Line s={s} />
        {s.payday.source === "month_end" && <span className="text-[13px] text-text-2">We haven&apos;t spotted a steady paycheque yet.</span>}
        <span className="mt-auto flex flex-col gap-2 w-full pt-1">
          {s.stale.length > 0 ? (
            <span className="self-start inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--ink,var(--warning))] bg-warning-subtle text-warning px-2.5 py-0.5 text-[12.5px] font-semibold">
              <AlertTriangle size={13} strokeWidth={2.4} aria-hidden="true" />
              {s.stale[0]!.name} {syncedAgo(s.stale[0]!.syncedAt)}
            </span>
          ) : (
            <Meter s={s} />
          )}
        </span>
      </button>
      <SafeToSpendPanel s={s} open={open} onClose={() => toggle(false)} />
    </>
  );
}

function Row({ title, sub, cents, children }: { title: React.ReactNode; sub?: React.ReactNode; cents: number; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2 border-t border-border first:border-t-0">
      <span className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[14px] text-text truncate">{title}</span>
        {sub && <span className="text-[12.5px] text-text-3">{sub}</span>}
        {children}
      </span>
      <M cents={cents} className="text-[14px] text-text tabular" />
    </li>
  );
}

function SafeToSpendPanel({ s, open, onClose }: { s: SafeToSpendResult; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cushion, setCushion] = useState(String(s.cushion / 100));
  const [saving, setSaving] = useState(false);

  async function saveCushion() {
    const cents = Math.round(Number(cushion || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      showToast("Enter an amount from $0 to $100,000.", "negative");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/safe-to-spend/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cushion: cents }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showToast("Couldn't save the cushion. Try again.", "negative");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const step = (label: string, cents: number, strong = false) => (
    <div className={cn("flex justify-between", strong ? "text-[15px] font-bold text-text" : "text-[14px] text-text-2")}>
      <span>{label}</span>
      <M cents={cents} className="tabular" />
    </div>
  );

  return (
    <SidePanel open={open} onClose={onClose}>
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-3">Safe to spend</span>
            <span className={cn("font-display text-[40px] leading-none tabular", s.amount < 0 ? "text-negative" : "text-text")}>
              <M cents={s.amount} />
            </span>
            <span className="text-[13.5px] text-text-2">
              Today – {shortDate(s.window.end)} · {s.window.days} day{s.window.days === 1 ? "" : "s"}
              {s.perDay != null && (
                <>
                  {" "}· about <M cents={Math.floor(s.perDay / 100) * 100} /> a day
                </>
              )}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="text-text-3 hover:text-text text-lg leading-none">
            ×
          </button>
        </div>

        {/* A card like any other (Pop's ink outline and hard shadow come from rounded-card.border). The
            labels carry the minus, so the amounts are magnitudes. */}
        <div className="flex flex-col gap-1.5 rounded-card border border-border shadow-raised bg-surface-2 px-4 py-3.5">
          {step(`Cash in ${s.cash.length} account${s.cash.length === 1 ? "" : "s"}`, s.cashTotal)}
          {step("− Bills before payday", s.billsTotal)}
          {step("− Card payments due", s.cardsTotal)}
          {step("− Cushion", s.cushion)}
          <div className="h-0.5 bg-[var(--ink,var(--border-strong))] my-1" />
          {step("Safe to spend", s.amount, true)}
        </div>

        <section className="flex flex-col gap-1">
          <h3 className="ui-card-title m-0 text-[16px] font-semibold text-text">Cash</h3>
          <ul className="m-0 p-0 list-none">
            {s.cash.map((a) => (
              <Row key={a.id} title={a.name} cents={a.balance} />
            ))}
          </ul>
          {s.notCounted.length > 0 && (
            <span className="text-[12.5px] text-text-3">
              {s.notCounted.map((a) => a.name).join(", ")} {s.notCounted.length === 1 ? "isn't" : "aren't"} counted. Savings stay separate.
            </span>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="ui-card-title m-0 text-[16px] font-semibold text-text">Bills before payday</h3>
          {s.bills.length === 0 ? (
            <p className="m-0 text-[13.5px] text-text-3">None due before payday.</p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {s.bills.map((b) => (
                <Row key={b.id} title={<Link href="/subscriptions" className="hover:underline">{b.label}</Link>} sub={b.overdue ? `Was due ${shortDate(b.dueDate)}` : shortDate(b.dueDate)} cents={b.amount} />
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="ui-card-title m-0 text-[16px] font-semibold text-text">Card payments due</h3>
          {s.cards.length === 0 ? (
            <p className="m-0 text-[13.5px] text-text-3">No statement due before payday.</p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {s.cards.map((c) => (
                <Row key={c.accountId} title={<Link href={`/cards?card=${c.accountId}`} className="hover:underline">{c.label}</Link>} sub={c.dueDate ? `Due ${shortDate(c.dueDate)} · statement left` : undefined} cents={c.amount}>
                  {c.assumed && (
                    <span className="flex flex-col items-start gap-1 pt-0.5">
                      <span className="text-[12px] font-semibold text-warning bg-warning-subtle rounded-full px-2 py-0.5">Assumed due before payday</span>
                      <Link href="/settings#safe-to-spend" className="text-[12.5px] font-semibold text-brand">
                        Add due day (optional)
                      </Link>
                    </span>
                  )}
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="ui-card-title m-0 text-[16px] font-semibold text-text">Cushion</h3>
          {editing ? (
            <div className="flex items-center gap-2">
              <label htmlFor="cushion" className="text-[13.5px] text-text-2 flex-1">
                Never dip below
              </label>
              <div className="flex items-center h-9 rounded-control border border-border-strong bg-surface px-2.5">
                <span className="text-text-3 text-[14px] pr-1">$</span>
                <input id="cushion" inputMode="decimal" value={cushion} onChange={(e) => setCushion(e.target.value.replace(/[^\d.]/g, ""))} className="w-20 bg-transparent text-right text-[14px] tabular outline-none" />
              </div>
              <button type="button" onClick={saveCushion} disabled={saving} className="ui-btn ui-btn-primary h-9 px-3.5 rounded-control bg-brand text-on-brand text-[13.5px] font-medium">
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[14px]">
              <span className="flex-1 text-text-2">Money you never want to dip below</span>
              <M cents={s.cushion} className="text-text tabular" />
              <button type="button" onClick={() => setEditing(true)} className="text-[13.5px] font-semibold text-brand">
                Change
              </button>
            </div>
          )}
        </section>

        <div className="pt-3 border-t border-border flex flex-wrap justify-between gap-2 text-[13px]">
          <span className="text-text-3">
            {s.payday.source === "paycheque" ? `Payday from ${s.payday.label} deposits` : s.payday.source === "schedule" ? "Payday from your income schedule" : "No payday found: counting to month end"}
          </span>
          <Link href="/settings#safe-to-spend" className="font-semibold text-brand">
            Choose which accounts count
          </Link>
        </div>
      </div>
    </SidePanel>
  );
}
