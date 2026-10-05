"use client";

import { useCallback, useMemo, useState } from "react";
import { formatCents, formatPercent } from "@tally/core/money";
import { connectionState, ago, type ConnectionState } from "@tally/core/connectionState";
import {
  allocationBy,
  describeInvestmentTxn,
  rollUpPositions,
  summarizeRange,
  unrealizedGainTotal,
  type AllocationView,
  type HistoryPoint,
  type HistoryRange,
  type Position,
  type TxnFilter,
} from "@tally/core/investments";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { ConnectionActionsProvider, useConnectionActions } from "@/components/accounts/ConnectionActions";
import { StateButton } from "@/components/accounts/ConnectionCard";
import { toneBorder, toneSubtle, toneText } from "@/components/accounts/connectionUi";
import { PortfolioChart } from "@/components/investments/PortfolioChart";
import { HoldingPanel } from "@/components/investments/HoldingPanel";
import { ActivityRow, Ticker, formatQuantity } from "@/components/investments/parts";
import type { ActivityView, HoldingView, InvestmentConnection } from "@/components/investments/types";

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1Y" },
  { key: "ALL", label: "All" },
];
const RANGE_PHRASE: Record<HistoryRange, string> = { "1M": "past month", "3M": "past 3 months", YTD: "this year", "1Y": "past year", ALL: "since tracking began" };
const ACTIVITY_PAGE = 10;
const SERIES = ["var(--series-1)", "var(--series-3)", "var(--series-4)", "var(--series-2)", "var(--series-5)", "var(--series-7)", "var(--series-6)", "var(--series-8)"];

export interface InvestmentsViewProps {
  holdings: HoldingView[];
  history: HistoryPoint[];
  activity: ActivityView[];
  connections: InvestmentConnection[];
  serverRefreshFailed: string[];
  today: string;
  baseCurrency: string;
  initialHoldingId: string | null;
}

export function InvestmentsView(props: InvestmentsViewProps) {
  return (
    <ConnectionActionsProvider serverRefreshFailed={props.serverRefreshFailed}>
      <InvestmentsBody {...props} />
    </ConnectionActionsProvider>
  );
}

function InvestmentsBody({ holdings, history, activity, connections, today, baseCurrency, initialHoldingId }: InvestmentsViewProps) {
  const { localFor } = useConnectionActions();

  // Connections whose data is old: their holdings render "as of".
  const connStates = useMemo(
    () => connections.map((c) => ({ conn: c, state: connectionState(c, localFor(c.id)) })),
    [connections, localFor],
  );
  const staleItemIds = useMemo(
    () => new Set(connStates.filter(({ conn, state }) => state.dimBalances || conn.badge === "serious").map(({ conn }) => conn.id)),
    [connStates],
  );
  const lastSyncedByItem = useMemo(() => new Map(connections.map((c) => [c.id, c.lastSyncedAt])), [connections]);

  const [holdingId, setHoldingId] = useState<string | null>(initialHoldingId);
  const openHolding = useCallback((id: string | null) => {
    setHoldingId(id);
    window.history.replaceState(window.history.state, "", id ? `${window.location.pathname}?holding=${encodeURIComponent(id)}` : window.location.pathname);
  }, []);

  const allPositions = useMemo(() => rollUpPositions(holdings), [holdings]);
  const panelPosition = allPositions.find((p) => p.securityId === holdingId) ?? null;
  const priceBySecurity = useMemo(() => new Map(holdings.map((h) => [h.securityId, h])), [holdings]);

  return (
    <>
      {connStates
        .filter(({ state }) => state.needsAttention)
        .map(({ conn, state }) => (
          <StaleNotice key={conn.id} conn={conn} state={state} holdings={holdings.filter((h) => h.itemId === conn.id)} />
        ))}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <HeroCard history={history} today={today} holdings={holdings} baseCurrency={baseCurrency} />
        <div className="flex flex-col gap-4">
          <MoneyInCard history={history} positions={allPositions} holdings={holdings} />
          <AllocationCard holdings={holdings} />
        </div>
      </div>

      <HoldingsTable holdings={holdings} staleItemIds={staleItemIds} lastSyncedByItem={lastSyncedByItem} onOpen={openHolding} />

      <ActivityCard activity={activity} today={today} />

      <HoldingPanel
        position={panelPosition}
        price={panelPosition ? (priceBySecurity.get(panelPosition.securityId) ?? null) : null}
        activity={panelPosition ? activity.filter((a) => a.securityId === panelPosition.securityId) : []}
        onClose={() => openHolding(null)}
      />
    </>
  );
}

function StaleNotice({ conn, state, holdings }: { conn: InvestmentConnection; state: ConnectionState; holdings: HoldingView[] }) {
  const { run } = useConnectionActions();
  const accounts = [...new Set(holdings.map((h) => h.accountName))];
  const value = holdings.reduce((s, h) => s + h.institutionValue, 0);
  const bank = conn.institutionName ?? "A bank";
  return (
    <div className={cn("flex items-center gap-3 rounded-card border px-4 py-3", toneSubtle[state.tone])} style={{ borderColor: toneBorder(state.tone, 25) }}>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={cn("text-[14px] font-semibold", toneText[state.tone])}>
          {bank} · {state.notice?.title ?? state.statusLine}
        </span>
        <span className="text-[13px] text-text-2">
          {accounts.length > 0 ? (
            <>
              {accounts.join(" and ")} (<span className="money tabular">{formatCents(value)}</span>) {accounts.length === 1 ? "is" : "are"} as of {ago(conn.lastSyncedAt)}.
            </>
          ) : (
            state.notice?.body
          )}
        </span>
      </div>
      {state.action && <StateButton action={state.action} tone={state.tone} pending={state.actionPending} onClick={() => run(conn, state.action!)} />}
    </div>
  );
}

function defaultRange(history: HistoryPoint[], today: string): HistoryRange {
  for (const r of ["1Y", "YTD", "3M", "1M"] as HistoryRange[]) if (summarizeRange(history, r, today).covered) return r;
  return "ALL";
}

function HeroCard({ history, today, holdings, baseCurrency }: { history: HistoryPoint[]; today: string; holdings: HoldingView[]; baseCurrency: string }) {
  const [range, setRange] = useState<HistoryRange>(() => defaultRange(history, today));
  const value = holdings.reduce((s, h) => s + h.institutionValue, 0);
  const summary = summarizeRange(history, range, today);
  const enough = history.length >= 2;
  const trackingSince = history[0]?.date;

  return (
    <Card className="lg:col-span-2 p-5 lg:p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Portfolio value ({baseCurrency})</span>
          <span className="font-display text-[44px] leading-none text-text tabular money">{formatCents(value)}</span>
          {enough && (
            <span className="text-[13.5px] text-text-2">
              <span className={cn("money", summary.growth < 0 ? "text-negative" : "text-positive")}>{formatCents(summary.growth, { signed: true })}</span>{" "}
              growth · <span className="money">{formatCents(summary.added, { signed: true })}</span> added · {RANGE_PHRASE[range]}
            </span>
          )}
        </div>
        {enough && (
          <div className="flex flex-col items-start sm:items-end gap-2.5">
            <div className="flex gap-1 rounded-full bg-sunken p-[3px]" role="tablist" aria-label="Chart range">
              {RANGES.map((r) => {
                const covered = summarizeRange(history, r.key, today).covered;
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="tab"
                    aria-selected={range === r.key}
                    disabled={!covered}
                    title={covered ? undefined : `Tracking since ${trackingSince}. ${r.label} unlocks once there's enough history.`}
                    onClick={() => setRange(r.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      range === r.key ? "bg-raised text-text" : "text-text-3 hover:text-text",
                      !covered && "opacity-40 cursor-not-allowed hover:text-text-3",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3.5 text-xs text-text-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-brand" />
                Value
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 border-t-[1.5px] border-dashed border-text-3" />
                Invested
              </span>
            </div>
          </div>
        )}
      </div>
      {enough ? (
        <PortfolioChart points={summary.points} longRange={range === "1Y" || range === "ALL"} />
      ) : (
        <div className="h-[200px] rounded-control bg-sunken flex items-center justify-center px-8 text-center text-[13.5px] text-text-2">
          Your chart starts filling in tomorrow. Tally records your portfolio once a day.
        </div>
      )}
    </Card>
  );
}

function MoneyInCard({ history, positions, holdings }: { history: HistoryPoint[]; positions: Position[]; holdings: HoldingView[] }) {
  const value = holdings.reduce((s, h) => s + h.institutionValue, 0);
  const unrealized = unrealizedGainTotal(positions);
  const last = history[history.length - 1];
  const enough = history.length >= 2 && last;
  const invested = last?.invested ?? 0;
  const growth = value - invested;

  return (
    <Card className="p-4 lg:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold text-text">Money in vs. growth</h2>
        {enough && (
          <span className="text-xs text-text-3">
            since {new Date(`${history[0]!.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>
      {enough && invested > 0 && (
        <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
          <span className="bg-text-3" style={{ flex: Math.max(invested, 0) }} />
          {growth > 0 && <span className="bg-positive" style={{ flex: growth }} />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Invested</span>
          {enough ? <span className="money tabular text-[17px] font-semibold text-text">{formatCents(invested)}</span> : <span className="text-[13px] text-text-3">After 2 days</span>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">{enough ? "Growth" : "Unrealized gain"}</span>
          {enough ? (
            <span className={cn("tabular text-[17px] font-semibold", growth < 0 ? "text-negative" : "text-positive")}>
              <span className="money">{formatCents(growth, { signed: true })}</span>
              {invested > 0 && <span> · {formatPercent(Math.abs(growth / invested))}</span>}
            </span>
          ) : unrealized.covered > 0 ? (
            <span className={cn("money tabular text-[17px] font-semibold", unrealized.amount < 0 ? "text-negative" : "text-positive")}>{formatCents(unrealized.amount, { signed: true })}</span>
          ) : (
            <span className="text-[13px] text-text-3">—</span>
          )}
        </div>
      </div>
      {enough && unrealized.covered > 0 && (
        <p className="m-0 text-xs leading-relaxed text-text-3">
          Growth is value minus what you put in. Unrealized gain on your current positions is{" "}
          <span className="money">{formatCents(unrealized.amount, { signed: true })}</span>
          {unrealized.covered < unrealized.total && ` (on ${unrealized.covered} of ${unrealized.total} holdings)`}.
        </p>
      )}
    </Card>
  );
}

function AllocationCard({ holdings }: { holdings: HoldingView[] }) {
  const [view, setView] = useState<AllocationView>("type");
  const slices = allocationBy(holdings, view);
  return (
    <Card className="p-4 lg:p-5 flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold text-text">Allocation</h2>
        <div className="flex gap-1 rounded-full bg-sunken p-[3px]" role="tablist" aria-label="Allocation view">
          {(["type", "account", "holding"] as AllocationView[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize", view === v ? "bg-raised text-text" : "text-text-3 hover:text-text")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
        {slices.map((s, i) => (
          <span key={s.label} style={{ flex: s.value, background: SERIES[i % SERIES.length] }} />
        ))}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {slices.map((s, i) => (
          <li key={s.label} className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2.5 text-[13px]">
            <span className="w-2 h-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-text truncate">{s.label}</span>
            <span className="text-text-3 tabular text-right">{formatPercent(s.pct)}</span>
            <span className="money tabular text-right text-text-2 min-w-[76px]">{formatCents(s.value)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type SortKey = "value" | "gain" | "gainPct" | "weight" | "name";

function HoldingsTable({
  holdings,
  staleItemIds,
  lastSyncedByItem,
  onOpen,
}: {
  holdings: HoldingView[];
  staleItemIds: Set<string>;
  lastSyncedByItem: Map<string, string | null>;
  onOpen: (securityId: string) => void;
}) {
  const accounts = useMemo(() => [...new Map(holdings.map((h) => [h.accountId, h.accountName])).entries()], [holdings]);
  const [account, setAccount] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "value", desc: true });

  const scoped = account ? holdings.filter((h) => h.accountId === account) : holdings;
  const positions = useMemo(() => {
    const ps = rollUpPositions(scoped);
    const val = (p: Position): number | string =>
      sort.key === "name" ? (p.ticker ?? p.securityName ?? "").toLowerCase() : sort.key === "gain" ? (p.gain?.amount ?? -Infinity) : sort.key === "gainPct" ? (p.gain?.pct ?? -Infinity) : sort.key === "weight" ? p.weight : p.value;
    return ps.sort((a, b) => {
      const [x, y] = [val(a), val(b)];
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [scoped, sort]);
  const itemByAccount = useMemo(() => new Map(holdings.map((h) => [h.accountId, h.itemId])), [holdings]);
  const priceBy = useMemo(() => new Map(holdings.map((h) => [h.securityId, h.institutionPrice])), [holdings]);
  const total = scoped.reduce((s, h) => s + h.institutionValue, 0);

  function header(key: SortKey, label: string, align: "left" | "right" = "right") {
    const active = sort.key === key;
    return (
      <th className={cn("px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap", align === "right" ? "text-right" : "text-left", active ? "text-text" : "text-text-3")} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
        <button type="button" className="uppercase tracking-wide hover:text-text" onClick={() => setSort({ key, desc: active ? !sort.desc : key !== "name" })}>
          {label}
          {active && (sort.desc ? " ↓" : " ↑")}
        </button>
      </th>
    );
  }

  function staleNote(p: Position): { text: string; partial: boolean } | null {
    const stale = p.lots.filter((l) => staleItemIds.has(itemByAccount.get(l.accountId) ?? ""));
    if (stale.length === 0) return null;
    const when = ago(lastSyncedByItem.get(itemByAccount.get(stale[0]!.accountId) ?? "") ?? null);
    return stale.length === p.lots.length ? { text: `as of ${when}`, partial: false } : { text: `${stale.map((l) => l.accountName).join(", ")} part as of ${when}`, partial: true };
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h2 className="m-0 text-[15px] font-semibold text-text">Holdings</h2>
          <span className="text-xs text-text-3">
            {positions.length} · <span className="money tabular">{formatCents(total)}</span>
          </span>
        </div>
        {accounts.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[[null, "All accounts"] as const, ...accounts].map(([id, name]) => (
              <button
                key={id ?? "all"}
                type="button"
                onClick={() => setAccount(id)}
                className={cn("text-xs px-3 py-1.5 rounded-full border", account === id ? "bg-brand-subtle text-brand border-transparent" : "border-border text-text-2 hover:text-text")}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px] min-w-[760px]">
          <thead className="bg-sunken border-y border-border">
            <tr>
              {header("name", "Holding", "left")}
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-text-3 hidden lg:table-cell">Accounts</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-text-3 hidden lg:table-cell">Quantity</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-text-3 hidden lg:table-cell">Price</th>
              {header("value", "Value")}
              {header("gain", "Gain")}
              {header("weight", "Weight")}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const note = staleNote(p);
              const price = priceBy.get(p.securityId);
              return (
                <tr key={p.securityId} onClick={() => onOpen(p.securityId)} className="border-b border-border last:border-b-0 hover:bg-surface-2 cursor-pointer">
                  <td className="px-4 py-2.5">
                    <button type="button" className="flex items-center gap-3 text-left" onClick={(e) => { e.stopPropagation(); onOpen(p.securityId); }}>
                      <Ticker p={p} />
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium text-text truncate max-w-[260px]">{p.securityName ?? p.ticker ?? "Unknown security"}</span>
                        <span className={cn("text-xs", note?.partial ? "text-negative" : "text-text-3")}>
                          {note ? note.text : `${p.isCashEquivalent ? "Cash" : formatType(p.assetType)}${p.originalCurrencies.some((c) => c !== "CAD") ? ` · ${p.originalCurrencies.join(", ")}, shown in CAD` : ""}`}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-text-3 hidden lg:table-cell">{p.lots.map((l) => l.accountName).join(", ")}</td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2 hidden lg:table-cell">{p.isCashEquivalent ? "—" : formatQuantity(p.quantity)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2 hidden lg:table-cell">{p.isCashEquivalent || price == null ? "—" : formatCents(price)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular font-medium", note && !note.partial ? "text-text-3" : "text-text")}>{formatCents(p.value)}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {p.gain ? (
                      <span className={cn("flex flex-col items-end", p.gain.amount < 0 ? "text-negative" : "text-positive")}>
                        {formatCents(p.gain.amount, { signed: true })}
                        <span className="text-xs">{p.gain.amount < 0 ? "−" : "+"}{formatPercent(Math.abs(p.gain.pct))}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-text-3" title={p.isCashEquivalent ? undefined : "Your brokerage didn't report what you paid for this holding."}>
                        {p.isCashEquivalent ? "—" : "No cost basis"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2 whitespace-nowrap">
                    {formatPercent(p.weight)}
                    <span className="inline-block align-middle ml-2 w-12 h-1 rounded-full bg-sunken overflow-hidden">
                      <span className="block h-full bg-text-3" style={{ width: `${Math.min(100, p.weight * 100)}%` }} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function formatType(t: string): string {
  return t === "etf" ? "ETF" : t.charAt(0).toUpperCase() + t.slice(1);
}

const FILTERS: { key: TxnFilter | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trades", label: "Buys & sells" },
  { key: "income", label: "Income" },
  { key: "deposits", label: "Deposits" },
  { key: "fees", label: "Fees" },
];

function ActivityCard({ activity, today }: { activity: ActivityView[]; today: string }) {
  const [filter, setFilter] = useState<TxnFilter | "all">("all");
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  if (activity.length === 0) return null;

  const described = activity.map((a) => ({ a, d: describeInvestmentTxn(a, (c) => formatCents(c)) }));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const thisYear = described.filter(({ a }) => a.date >= yearStart);
  const income = thisYear.filter(({ d }) => d.filter === "income" && d.tone === "positive").reduce((s, { d }) => s + d.amount, 0);
  const added = thisYear.filter(({ d }) => d.filter === "deposits").reduce((s, { d }) => s + d.amount, 0);
  const rows = filter === "all" ? activity : described.filter(({ d }) => d.filter === filter).map(({ a }) => a);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="m-0 text-[15px] font-semibold text-text">Activity</h2>
          <span className="text-xs text-text-3">
            Income this year <span className="tabular text-positive">{formatCents(income, { signed: true })}</span> · Added this year{" "}
            <span className="tabular text-text">{formatCents(added, { signed: true })}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setShown(ACTIVITY_PAGE);
              }}
              className={cn("text-xs px-3 py-1.5 rounded-full border", filter === f.key ? "bg-brand-subtle text-brand border-transparent" : "border-border text-text-2 hover:text-text")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 px-5 py-6 border-t border-border text-[13.5px] text-text-3">Nothing here in your recent activity.</p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {rows.slice(0, shown).map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </ul>
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + ACTIVITY_PAGE)} className="w-full px-5 py-3 border-t border-border text-[13.5px] text-text-2 hover:bg-sunken">
          Show more ({rows.length - shown} left)
        </button>
      )}
    </Card>
  );
}
