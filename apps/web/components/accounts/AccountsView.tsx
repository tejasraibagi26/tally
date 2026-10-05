"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { connectionState, type ConnectionState } from "@tally/core/connectionState";
import { cn } from "@/lib/cn";
import { ConnectionActionsProvider, useConnectionActions } from "@/components/accounts/ConnectionActions";
import { ConnectionCard } from "@/components/accounts/ConnectionCard";
import { NeedsYouPanel } from "@/components/accounts/NeedsYouPanel";
import { BankPanel } from "@/components/accounts/BankPanel";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";
import type { ConnectionView } from "@/components/accounts/types";

const TOAST_MS = 4000;

/**
 * The interactive part of the Accounts page: the Needs you panel, the card
 * grid sorted by urgency, and the bank side panel. Every card's level, copy
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
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    const withState = items.map((item) => ({ item, state: connectionState(item, localFor(item.id)) }));
    return withState.sort(
      (a, b) => a.state.rank - b.state.rank || (a.item.institutionName ?? "").localeCompare(b.item.institutionName ?? ""),
    );
  }, [items, localFor]);

  const needsYou = rows.filter((r) => r.state.needsAttention);
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

  // Sync-all success is a toast; failures keep using the persistent
  // SyncFailureBanner (DESIGN.md §8 toast rule).
  useEffect(() => {
    function onResult(e: Event) {
      const { failedItems } = (e as CustomEvent<SyncResultEventDetail>).detail;
      if (failedItems.length === 0) setToast(items.length === 1 ? "Your bank is synced" : `All ${items.length} banks synced`);
    }
    window.addEventListener(SYNC_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SYNC_RESULT_EVENT, onResult);
  }, [items.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {needsYou.length > 0 && <NeedsYouPanel rows={needsYou} onOpenPanel={openPanel} />}

      {urgent.length > 0 && <Group label={rest.length > 0 ? "Needs you" : undefined} rows={urgent} baseCurrency={baseCurrency} onOpenPanel={openPanel} />}
      {rest.length > 0 && <Group label={urgent.length > 0 ? "Up to date" : undefined} rows={rest} baseCurrency={baseCurrency} onOpenPanel={openPanel} />}

      <BankPanel item={panelRow?.item ?? null} state={panelRow?.state ?? null} open={panelRow !== null} onClose={closePanel} />

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-40 flex items-center gap-2.5 rounded-control bg-raised border border-border shadow-overlay px-4 py-2.5 text-[13.5px] text-text">
          <span className="w-1.5 h-1.5 rounded-full bg-positive" />
          {toast}
        </div>
      )}
    </>
  );
}

function Group({
  label,
  rows,
  baseCurrency,
  onOpenPanel,
}: {
  label?: string;
  rows: { item: ConnectionView; state: ConnectionState }[];
  baseCurrency: string;
  onOpenPanel: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <h2 className="m-0 text-[11px] font-semibold">{label}</h2>
          <span>
            {rows.length} bank{rows.length === 1 ? "" : "s"}
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
