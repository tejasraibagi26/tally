"use client";

import { X } from "lucide-react";
import { formatCents, formatPercent } from "@tally/core/money";
import type { Position } from "@tally/core/investments";
import { cn } from "@/lib/cn";
import { SidePanel } from "@/components/ui/SidePanel";
import { ActivityRow, Ticker, formatQuantity } from "@/components/investments/parts";
import type { ActivityView, HoldingView } from "@/components/investments/types";

/**
 * One position across every account (?holding=<securityId>): value and gain,
 * cost per share, the split by account, and this security's activity.
 */
export function HoldingPanel({
  position: p,
  price,
  activity,
  onClose,
}: {
  position: Position | null;
  price: HoldingView | null;
  activity: ActivityView[];
  onClose: () => void;
}) {
  if (!p) return null;
  const name = p.securityName ?? p.ticker ?? "Unknown security";
  const avgCost = p.costBasis != null && p.quantity > 0 ? p.costBasis / p.quantity : null;
  const priceLine = [
    p.isCashEquivalent ? "Cash" : p.assetType === "etf" ? "ETF" : p.assetType.charAt(0).toUpperCase() + p.assetType.slice(1),
    p.originalCurrencies.join(", "),
    price?.priceAsOf && `price as of ${new Date(`${price.priceAsOf}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SidePanel open onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-3">
          <Ticker p={p} size={40} />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h2 className="m-0 text-lg font-semibold text-text truncate">{name}</h2>
            <span className="text-xs text-text-3">{priceLine}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex-none flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Value</span>
            <span className="font-display text-[32px] leading-none tabular text-text">{formatCents(p.value)}</span>
          </div>
          {p.gain && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Gain</span>
              <span className={cn("tabular text-base font-semibold", p.gain.amount < 0 ? "text-negative" : "text-positive")}>
                {formatCents(p.gain.amount, { signed: true })} · {p.gain.amount < 0 ? "−" : "+"}
                {formatPercent(Math.abs(p.gain.pct))}
              </span>
            </div>
          )}
        </div>

        {!p.isCashEquivalent && (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-control bg-sunken px-4 py-3.5 text-[13px]">
            <dt className="text-text-3">Quantity</dt>
            <dd className="m-0 text-right tabular text-text">{formatQuantity(p.quantity)} shares</dd>
            <dt className="text-text-3">Price</dt>
            <dd className="m-0 text-right tabular text-text">{price?.institutionPrice != null ? formatCents(price.institutionPrice) : "—"}</dd>
            <dt className="text-text-3">Average cost</dt>
            <dd className="m-0 text-right tabular text-text">{avgCost != null ? `${formatCents(Math.round(avgCost))} / share` : "Not reported"}</dd>
            <dt className="text-text-3">Cost basis</dt>
            <dd className="m-0 text-right tabular text-text">{p.costBasis != null ? formatCents(p.costBasis) : "Not reported"}</dd>
            <dt className="text-text-3">Weight</dt>
            <dd className="m-0 text-right tabular text-text">{formatPercent(p.weight)} of portfolio</dd>
          </dl>
        )}

        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">By account</h3>
          <ul className="m-0 p-0 list-none">
            {p.lots.map((l, i) => (
              <li key={l.accountId} className={cn("flex items-center justify-between gap-3 py-2.5 text-[13.5px]", i > 0 && "border-t border-border")}>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-text truncate">{l.accountName}</span>
                  {!p.isCashEquivalent && <span className="text-xs text-text-3 tabular">{formatQuantity(l.quantity)} sh</span>}
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="tabular font-medium text-text">{formatCents(l.value)}</span>
                  {l.gain && (
                    <span className={cn("text-xs tabular", l.gain.amount < 0 ? "text-negative" : "text-positive")}>
                      {l.gain.amount < 0 ? "−" : "+"}
                      {formatPercent(Math.abs(l.gain.pct))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-1 -mx-6">
          <h3 className="m-0 px-6 text-[11px] font-semibold uppercase tracking-wide text-text-3">Activity</h3>
          {activity.length === 0 ? (
            <p className="m-0 px-6 py-2 text-[13px] text-text-3">No recent activity for this holding.</p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {activity.slice(0, 10).map((a) => (
                <ActivityRow key={a.id} a={a} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </SidePanel>
  );
}
