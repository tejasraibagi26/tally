"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCents, formatPercent } from "@tally/core/money";
import type { CardNetwork, CardView } from "@tally/core/cardView";
import { SidePanel } from "@/components/ui/SidePanel";
import { CardTile } from "@/components/cards/CardTile";
import { CreditLimitEditor } from "@/components/cards/CreditLimitEditor";
import { AccountNicknameEditor } from "@/components/accounts/AccountNicknameEditor";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
import { cn } from "@/lib/cn";

export interface CardItem {
  accountId: string;
  name: string;
  nickname: string | null;
  displayName: string;
  mask: string | null;
  bankName: string;
  color: string | null;
  logo: string | null;
  network: CardNetwork | null;
  balance: number;
  limit: number | null;
  limitIsManual: boolean;
  view: CardView;
  statementDate: string | null;
  statementBalance: number | null;
  minimum: number | null;
  dueDate: string | null;
  aprs: { apr_percentage: number; apr_type: string }[];
  hasLiability: boolean;
  itemId: string | null;
  /** True when the bank connection needs a fix (sign-in, error, access ending). */
  needsFix: boolean;
  asOf: string | null;
}

const APR_TYPE_LABEL: Record<string, string> = {
  purchase_apr: "Purchase",
  cash_apr: "Cash advance",
  balance_transfer_apr: "Balance transfer",
  special: "Special",
};

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function toneClass(v: CardView): string {
  return v.utilizationTone === "over" ? "text-negative" : v.utilizationTone === "high" ? "text-warning" : "text-text-3";
}

function barColor(v: CardView): string {
  return v.utilizationTone === "over" ? "var(--negative)" : v.utilizationTone === "high" ? "var(--warning)" : "var(--brand)";
}

/** A thin utilization bar with a tick at 30%, the Healthy/High line. */
function UtilBar({ view, className }: { view: CardView; className?: string }) {
  if (view.utilization == null) return null;
  return (
    <span className={cn("relative inline-block h-1 rounded-full bg-sunken align-middle", className)} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(1, Math.max(0, view.utilization)) * 100}%`, background: barColor(view) }} />
      <span className="absolute -top-0.5 -bottom-0.5 w-px bg-text opacity-40" style={{ left: "30%" }} />
    </span>
  );
}

/** The row's status in words: paid, what's left, the due label, or overdue. */
function Status({ card }: { card: CardItem }) {
  const v = card.view;
  if (v.state === "paid") return <span className="text-[12.5px] font-semibold text-positive">✓ Paid in full</span>;
  if (v.state === "noStatement") return <span className="text-[12.5px] text-text-3">{card.hasLiability ? "No statement yet" : "Statement details not sent yet"}</span>;
  const chip = v.state === "overdue" ? "bg-negative-subtle text-negative" : v.state === "dueSoon" ? "bg-warning-subtle text-warning" : "";
  if (chip) return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold", chip)}>{v.dueLabel}</span>;
  return (
    <span className="text-[12.5px] text-text-2 tabular">
      {v.paid > 0 && v.left != null ? `${formatCents(v.left)} left · ` : ""}
      {v.dueLabel ?? "—"}
    </span>
  );
}

/**
 * Credit cards: the summary band (You owe, Next payment, Credit used), one
 * flat table of cards sorted by what needs you, and a card's side panel
 * (?card=). Every card's state comes from @tally/core/cardView, the same
 * rules mobile and Upcoming use.
 */
export function CardsView({
  cards,
  totalOwed,
  next,
  utilization,
}: {
  cards: CardItem[];
  totalOwed: number;
  next: CardItem | null;
  utilization: { utilization: number | null; totalBalance: number; totalLimit: number; excludedCount: number };
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("card");
    if (id) setOpenId(id);
  }, []);
  const open = useCallback((id: string | null) => {
    setOpenId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("card", id);
    else params.delete("card");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);
  const selected = cards.find((c) => c.accountId === openId) ?? null;
  const healthHigh = utilization.utilization != null && utilization.utilization >= 0.3;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 px-0.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">You owe</span>
          <span className="font-display text-[34px] leading-none text-text tabular money">{formatCents(totalOwed)}</span>
          <span className="text-[12.5px] text-text-2">across {cards.length} card{cards.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Next payment</span>
          {next ? (
            <>
              <span
                className={cn(
                  "font-display text-[34px] leading-none tabular money",
                  next.view.state === "overdue" ? "text-negative" : next.view.state === "dueSoon" ? "text-warning" : "text-text",
                )}
              >
                {next.view.amountDue != null ? formatCents(next.view.amountDue) : formatCents(next.view.left ?? 0)}
              </span>
              <span className="text-[12.5px] text-text-2">
                {next.displayName}
                {next.mask ? ` ••${next.mask}` : ""} · {next.view.dueLabel ?? (next.dueDate ? `due ${shortDate(next.dueDate)}` : "")}
                {next.view.amountDue == null && " · Min. unknown"}
              </span>
            </>
          ) : (
            <>
              <span className="font-display text-[34px] leading-none text-positive">All paid</span>
              <span className="text-[12.5px] text-text-2">Nothing due until your next statements close</span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Credit used</span>
          <span className="font-display text-[34px] leading-none text-text tabular">{utilization.utilization != null ? formatPercent(utilization.utilization) : "—"}</span>
          <span className="text-[12.5px] text-text-2">
            {utilization.utilization != null ? (
              <>
                <span className={healthHigh ? "text-warning" : "text-positive"}>{healthHigh ? "High" : "Healthy"}</span>
                <span className="money"> · {formatCents(utilization.totalBalance)} of {formatCents(utilization.totalLimit)}</span>
              </>
            ) : (
              "No card reports a limit"
            )}
            {utilization.excludedCount > 0 && ` · ${utilization.excludedCount} left out, no limit`}
          </span>
        </div>
      </div>

      <div className="rounded-card bg-surface border border-border overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-3 border-b border-border">
              <th className="px-4 py-2.5 font-semibold">Card</th>
              <th className="px-4 py-2.5 font-semibold">Balance · used</th>
              <th className="px-4 py-2.5 font-semibold text-right">Statement</th>
              <th className="px-4 py-2.5 font-semibold text-right">Paid since</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const paid = c.view.state === "paid";
              return (
                <tr
                  key={c.accountId}
                  onClick={() => open(c.accountId)}
                  className={cn("border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-2", c.needsFix && "opacity-75", openId === c.accountId && "bg-surface-2")}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <CardTile bankName={c.bankName} color={c.color} logo={c.logo} network={c.network} />
                      <span className="flex flex-col min-w-0">
                        <span className={cn("truncate", paid ? "text-text-2" : "text-text font-semibold")}>{c.displayName}</span>
                        <span className="font-mono text-[11.5px] text-text-3">
                          ••{c.mask ?? "----"}
                          {c.needsFix && c.asOf && <span className="font-sans"> · as of {c.asOf}</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("tabular money", c.balance < 0 ? "text-positive" : paid ? "text-text-2" : "text-text font-semibold")}>
                      {c.balance < 0 ? `${formatCents(-c.balance)} credit` : formatCents(c.balance)}
                    </span>
                    {c.view.utilization != null ? (
                      <>
                        <UtilBar view={c.view} className="w-[90px] ml-3" />
                        <span className={cn("ml-2 text-[12px] tabular", toneClass(c.view))}>
                          {c.view.utilizationTone === "over" ? `${formatCents(c.balance - (c.limit ?? 0))} over` : formatPercent(c.view.utilization)}
                        </span>
                      </>
                    ) : (
                      <span className="ml-3 text-[12px] text-text-3">No limit</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular money text-text-2">{c.statementBalance != null ? formatCents(c.statementBalance) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular money text-text-2">{c.statementDate ? formatCents(c.view.paid) : "—"}</td>
                  <td className="px-4 py-3">
                    {c.needsFix && c.itemId ? (
                      <Link href={`/accounts?bank=${c.itemId}`} onClick={(e) => e.stopPropagation()} className="text-[12.5px] font-semibold text-negative">
                        Reconnect
                      </Link>
                    ) : (
                      <Status card={c} />
                    )}
                  </td>
                  <td className="pr-3 text-text-3">
                    <ChevronRight size={15} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CardPanel card={selected} onClose={() => open(null)} />
    </>
  );
}

interface Charge {
  id: string;
  merchantName: string | null;
  name: string;
  postedDate: string;
  amount: number;
  isPending: boolean;
  logoUrl?: string | null;
}

function CardPanel({ card, onClose }: { card: CardItem | null; onClose: () => void }) {
  const [charges, setCharges] = useState<{ items: Charge[]; total: number } | null>(null);
  const id = card?.accountId ?? null;
  const from = card?.statementDate ?? null;

  useEffect(() => {
    setCharges(null);
    if (!id) return;
    let cancelled = false;
    const params = new URLSearchParams({ account: id });
    if (from) params.set("from", from);
    params.set("to", new Date().toISOString().slice(0, 10));
    fetch(`/api/transactions?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setCharges({ items: d.items.slice(0, 6), total: d.pagination.total }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, from]);

  if (!card) return null;
  const v = card.view;
  const steps: { label: string; sub: string; done: boolean }[] = [
    { label: "Closed", sub: card.statementDate ? shortDate(card.statementDate) : "—", done: !!card.statementDate },
    { label: v.paid > 0 ? `Paid ${formatCents(v.paid)}` : "Not paid yet", sub: v.state === "paid" ? "In full" : v.minimumMet ? "Minimum covered" : "", done: v.paid > 0 },
    { label: "Due", sub: card.dueDate ? shortDate(card.dueDate) : "—", done: v.state === "paid" },
  ];
  const txQuery = new URLSearchParams({ account: card.accountId, ...(card.statementDate ? { from: card.statementDate } : {}) });

  return (
    <SidePanel open onClose={onClose}>
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CardTile bankName={card.bankName} color={card.color} logo={card.logo} network={card.network} size="lg" mask={card.mask} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[16px] font-semibold text-text truncate">{card.displayName}</span>
              <span className="text-[12.5px] text-text-3">{card.bankName}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="text-text-3 hover:text-text text-lg leading-none">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className={cn("font-display text-[40px] leading-none tabular money", card.balance < 0 ? "text-positive" : "text-text")}>
            {card.balance < 0 ? `${formatCents(-card.balance)} credit` : formatCents(card.balance)}
          </span>
          <span className="text-[13px] text-text-2">
            {v.utilization != null ? (
              <>
                <span className={toneClass(v)}>{formatPercent(v.utilization)}</span> of your {formatCents(card.limit ?? 0)} limit
                {card.limitIsManual ? " · set by you" : ""}
              </>
            ) : (
              "No limit reported"
            )}
          </span>
          <UtilBar view={v} className="w-full h-1.5" />
        </div>

        {card.needsFix && card.itemId && (
          <div className="rounded-control border border-border bg-negative-subtle px-3.5 py-2.5 text-[13px] text-text-2">
            <b className="block text-negative font-semibold">This card&apos;s bank needs you</b>
            Numbers are from {card.asOf ?? "the last sync"}.{" "}
            <Link href={`/accounts?bank=${card.itemId}`} className="font-semibold text-negative">
              Reconnect
            </Link>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">This statement</h3>
          {card.statementDate ? (
            <>
              <div className="flex items-center px-1" aria-hidden="true">
                {steps.map((s, i) => (
                  <span key={i} className="contents">
                    {i > 0 && <span className={cn("flex-1 h-0.5", steps[i]!.done ? "bg-positive" : "bg-border")} />}
                    <span className={cn("w-2.5 h-2.5 rounded-full border-2 flex-none", s.done ? "bg-positive border-positive" : "border-text-3 bg-raised")} />
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 text-[11.5px] text-text-3">
                {steps.map((s, i) => (
                  <span key={i} className={cn(i === 1 && "text-center", i === 2 && "text-right")}>
                    <span className="block text-text-2">{s.label}</span>
                    {s.sub}
                  </span>
                ))}
              </div>
              <dl className="m-0 flex flex-col text-[13.5px]">
                <Row label="Statement balance" value={card.statementBalance != null ? formatCents(card.statementBalance) : "—"} />
                <Row label="Paid so far" value={formatCents(v.paid)} />
                <Row label="Left to avoid interest" value={v.left != null ? formatCents(v.left) : "—"} strong />
                <Row label="Minimum" value={card.minimum == null ? "Unknown" : v.minimumMet ? "✓ Covered" : formatCents(card.minimum)} tone={v.minimumMet ? "text-positive" : undefined} />
              </dl>
              {v.left != null && v.left > 0 && card.dueDate && (
                <p className="m-0 text-[12.5px] text-text-2 leading-snug">
                  Paying {formatCents(v.left)} by {shortDate(card.dueDate)} usually means no interest on purchases.
                </p>
              )}
            </>
          ) : (
            <p className="m-0 text-[13px] text-text-2">{card.hasLiability ? "No statement yet. New cards get one after their first cycle." : "Your bank hasn't sent statement details for this card yet."}</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">{card.statementDate ? "Since the statement" : "Recent charges"}</h3>
            <Link href={`/transactions?${txQuery}`} className="text-[12.5px] font-medium text-brand">
              {charges ? `All ${charges.total}` : "View all"} →
            </Link>
          </div>
          {charges == null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-control bg-surface-2 animate-pulse motion-reduce:animate-none" />
              ))}
            </div>
          ) : charges.items.length === 0 ? (
            <p className="m-0 text-[13px] text-text-3">No charges yet this cycle.</p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col">
              {charges.items.map((t) => {
                const name = t.merchantName ?? t.name;
                return (
                  <li key={t.id} className="flex items-center gap-2.5 py-2 border-t border-border first:border-t-0">
                    <MerchantAvatar name={name} logoUrl={t.logoUrl} className="w-7 h-7 rounded-[8px] text-xs" />
                    <span className="flex-1 min-w-0 truncate text-[13.5px] text-text">
                      {name}
                      {t.isPending && <span className="ml-1.5 text-[11px] italic text-text-3">pending</span>}
                    </span>
                    <span className="text-[12px] text-text-3">{shortDate(t.postedDate)}</span>
                    <span className={cn("w-20 text-right text-[13.5px] tabular money", t.amount > 0 ? "text-positive" : "text-text")}>{formatCents(t.amount, { signed: true })}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {card.aprs.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">Interest rates</h3>
            <dl className="m-0 flex flex-col text-[13.5px]">
              {card.aprs.map((a) => (
                <Row key={a.apr_type} label={APR_TYPE_LABEL[a.apr_type] ?? a.apr_type} value={`${a.apr_percentage.toFixed(2)}%`} />
              ))}
            </dl>
          </section>
        )}

        <section className="flex flex-col gap-2 pt-3 border-t border-border">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">Card</h3>
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-text-2">Name on Tally</span>
            <AccountNicknameEditor accountId={card.accountId} name={card.name} nickname={card.nickname} className="text-text text-right" />
          </div>
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-text-2">Credit limit</span>
            <span className="flex items-center gap-2">
              {card.limit != null && <span className="text-text tabular money">{formatCents(card.limit)}</span>}
              {(card.limit == null || card.limitIsManual) && <CreditLimitEditor accountId={card.accountId} creditLimitIsManual={card.limitIsManual} />}
              {card.limit != null && !card.limitIsManual && <span className="text-[12px] text-text-3">from {card.bankName}</span>}
            </span>
          </div>
        </section>
      </div>
    </SidePanel>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-t border-border first:border-t-0">
      <dt className="text-text-2">{label}</dt>
      <dd className={cn("m-0 tabular text-right", strong ? "font-semibold text-text" : "text-text", tone)}>{value}</dd>
    </div>
  );
}
