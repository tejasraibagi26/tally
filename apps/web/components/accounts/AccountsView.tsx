"use client";

import { useCallback, useMemo, useState } from "react";
import { connectionState, type ConnectionState } from "@tally/core/connectionState";
import { formatCents } from "@tally/core/money";
import { cn } from "@/lib/cn";
import { ConnectionActionsProvider, useConnectionActions } from "@/components/accounts/ConnectionActions";
import { ConnectionCard } from "@/components/accounts/ConnectionCard";
import { toneText } from "@/components/accounts/connectionUi";
import { BankPanel } from "@/components/accounts/BankPanel";
import type { ConnectionView } from "@/components/accounts/types";

/**
 * The interactive part of the Accounts page: the card grid sorted by
 * urgency (banks that need you first, under their own heading) and the bank
 * side panel. Each problem is said once, on its own card, next to its fix. Every card's level, copy
 * and action come from @tally/core/connectionState -- the same contract the
 * mobile app renders.
 */
export function AccountsView(props: { items: ConnectionView[]; baseCurrency: string; initialBankId: string | null; serverRefreshFailed: string[] }) {
  const [bankId, setBankId] = useState<string | null>(props.initialBankId);
  return (
    <ConnectionActionsProvider serverRefreshFailed={props.serverRefreshFailed} onRemoved={(id) => id === bankId && setBankId(null)}>
      <AccountsGrid {...props} bankId={bankId} setBankId={setBankId} />
    </ConnectionActionsProvider>
  );
}

function AccountsGrid({
  items,
  baseCurrency,
  bankId,
  setBankId,
}: {
  items: ConnectionView[];
  baseCurrency: string;
  bankId: string | null;
  setBankId: (id: string | null) => void;
}) {
  const { localFor } = useConnectionActions();

  const rows = useMemo(() => {
    const withState = items.map((item) => ({ item, state: connectionState(item, localFor(item.id)) }));
    return withState.sort(
      (a, b) => a.state.rank - b.state.rank || (a.item.institutionName ?? "").localeCompare(b.item.institutionName ?? ""),
    );
  }, [items, localFor]);

  const needsYou = rows.filter((r) => r.state.needsAttention);
  // Money whose numbers can't be trusted right now -- the size of the problem.
  const affected = needsYou.reduce((sum, r) => sum + r.item.accounts.reduce((s, a) => s + Math.abs(a.currentBalance ?? 0), 0), 0);
  // Rank 0–1 is anything blocked, needing action, or just fixed (held in
  // place until its confirmation fades); everything else is up to date.
  const urgent = rows.filter((r) => r.state.rank <= 1);
  const rest = rows.filter((r) => r.state.rank > 1);

  // The panel's open bank lives in the URL (?bank=) so alert emails and the
  // Overview link can deep-link to it; replaceState keeps it out of history.
  const openPanel = useCallback(
    (id: string | null) => {
      setBankId(id);
      const url = id ? `${window.location.pathname}?bank=${encodeURIComponent(id)}` : window.location.pathname;
      window.history.replaceState(window.history.state, "", url);
    },
    [setBankId],
  );
  const closePanel = useCallback(() => openPanel(null), [openPanel]);
  const panelRow = rows.find((r) => r.item.id === bankId) ?? null;

  return (
    <>
      {urgent.length > 0 && (
        <Group
          label={needsYou.length > 0 ? "Needs you" : rest.length > 0 ? "Just fixed" : undefined}
          tone={needsYou.length === 0 ? undefined : needsYou.some((r) => r.state.level === "blocked") ? "negative" : "warning"}
          meta={affected > 0 ? `${formatCents(affected)} in balances affected` : undefined}
          rows={urgent}
          baseCurrency={baseCurrency}
          onOpenPanel={openPanel}
        />
      )}
      {rest.length > 0 && <Group label={urgent.length > 0 ? "Up to date" : undefined} rows={rest} baseCurrency={baseCurrency} onOpenPanel={openPanel} />}

      <BankPanel item={panelRow?.item ?? null} state={panelRow?.state ?? null} open={panelRow !== null} onClose={closePanel} />
    </>
  );
}

function Group({
  label,
  tone,
  meta,
  rows,
  baseCurrency,
  onOpenPanel,
}: {
  label?: string;
  /** Colors the heading for the group of banks that need you. */
  tone?: "negative" | "warning";
  /** Extra context beside the bank count. */
  meta?: string;
  rows: { item: ConnectionView; state: ConnectionState }[];
  baseCurrency: string;
  onOpenPanel: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <h2 className={cn("m-0 text-[11px] font-semibold", tone && toneText[tone])}>{label}</h2>
          <span className="tabular-nums">
            {rows.length} bank{rows.length === 1 ? "" : "s"}
            {meta && <span className="normal-case tracking-normal font-normal"> · {meta}</span>}
          </span>
        </div>
      )}
      {/* items-stretch + each card being a full-height flex column means two
          cards side by side always match: the shorter grows to the taller
          one's height with its footer pinned to the bottom. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {rows.map(({ item, state }) => (
          <div key={item.id} className={cn(rows.length === 1 && "lg:col-span-2")}>
            <ConnectionCard item={item} state={state} baseCurrency={baseCurrency} onOpenPanel={() => onOpenPanel(item.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
