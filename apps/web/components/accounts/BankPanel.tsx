"use client";

import { RefreshCw, KeyRound, Unplug, X } from "lucide-react";
import { formatCents } from "@tally/core/money";
import type { ConnectionState } from "@tally/core/connectionState";
import { cn } from "@/lib/cn";
import { SidePanel } from "@/components/ui/SidePanel";
import { useConnectionActions } from "@/components/accounts/ConnectionActions";
import { ConnectionAvatar, StateNotice, StatusLine } from "@/components/accounts/ConnectionCard";
import { exactTime, toneText } from "@/components/accounts/connectionUi";
import type { ConnectionView, SyncRunView } from "@/components/accounts/types";

const KIND_LABEL: Record<string, string> = {
  transactions: "Transactions",
  holdings: "Holdings",
  inv_tx: "Investment activity",
  liabilities: "Card and loan details",
  balances: "Balances",
};

/**
 * One bank's detail panel (opened from its card or the Needs you panel, or
 * deep-linked as /accounts?bank=<itemId>): plain-language status with exact
 * times, the fix if one is needed, recent sync history from sync_runs, and
 * the actions that used to live in the "⋯" dropdown.
 */
export function BankPanel({
  item,
  state,
  open,
  onClose,
}: {
  item: ConnectionView | null;
  state: ConnectionState | null;
  open: boolean;
  onClose: () => void;
}) {
  const { refresh, signIn, confirmRemove, localFor } = useConnectionActions();
  if (!item || !state) return null;
  const name = item.institutionName ?? "Unknown institution";
  const lastGood = item.runs.find((r) => !r.error && r.finishedAt);

  return (
    <SidePanel open={open} onClose={onClose}>
      <div className="flex flex-col gap-5 p-6 min-h-full">
        <div className="flex items-center gap-3">
          <ConnectionAvatar name={item.institutionName} state={state} size={40} />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h2 className="m-0 text-lg font-semibold text-text truncate">{name}</h2>
            <StatusLine state={state} lastSyncedAt={item.lastSyncedAt} />
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex-none flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken">
            <X size={18} />
          </button>
        </div>

        <StateNotice item={item} state={state} />

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-control bg-sunken px-4 py-3.5 text-[13px]">
          <dt className="text-text-3">Status</dt>
          <dd className={cn("m-0 text-right font-medium", state.level === "quiet" ? "text-text" : toneText[state.tone])}>
            {state.notice?.title.replace(/…$/, "") ?? (state.level === "quiet" ? "Up to date" : state.statusLine)}
          </dd>
          <dt className="text-text-3">Last synced</dt>
          <dd className="m-0 text-right text-text tabular">{item.lastSyncedAt ? exactTime(item.lastSyncedAt) : "Never"}</dd>
          <dt className="text-text-3">Connected</dt>
          <dd className="m-0 text-right text-text tabular">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>
          <dt className="text-text-3">Accounts</dt>
          <dd className="m-0 text-right text-text tabular">{item.accounts.length}</dd>
          <dt className="text-text-3">In your totals</dt>
          <dd className="m-0 text-right text-text">
            <span className="tabular money">{formatCents(item.total)}</span>
            {state.dimBalances && item.lastSyncedAt && <span className="text-text-3"> as of {exactTime(item.lastSyncedAt)}</span>}
          </dd>
        </dl>

        <div className="flex flex-col -mx-2">
          <PanelAction icon={RefreshCw} label="Refresh balances" hint="Fetch the latest balances now" busy={localFor(item.id).refreshing} onClick={() => refresh(item.id)} />
          <PanelAction icon={KeyRound} label="Manage access" hint="Sign in again or change which accounts Tally sees" busy={localFor(item.id).linking} onClick={() => signIn(item.id)} />
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">Sync history</h3>
          {item.runs.length === 0 ? (
            <p className="m-0 text-[13px] text-text-3">No syncs recorded yet.</p>
          ) : (
            <ol className="m-0 p-0 list-none flex flex-col">
              {item.runs.map((r, i) => (
                <SyncRunRow key={r.id} run={r} first={i === 0} />
              ))}
            </ol>
          )}
          {lastGood && item.runs[0]?.error && (
            <p className="m-0 text-xs text-text-3">Last successful sync: {exactTime(lastGood.finishedAt!)}</p>
          )}
        </section>

        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-4">
          <span className="text-xs text-text-3">Deletes this bank&apos;s accounts and history.</span>
          <button
            type="button"
            onClick={() => confirmRemove(item)}
            className="h-8 px-3 rounded-control text-[13px] font-medium text-negative hover:bg-negative-subtle inline-flex items-center gap-1.5 flex-none"
          >
            <Unplug size={14} /> Revoke connection
          </button>
        </div>
      </div>
    </SidePanel>
  );
}

function PanelAction({ icon: Icon, label, hint, busy, onClick }: { icon: typeof RefreshCw; label: string; hint: string; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="flex items-center gap-3 px-2 py-2.5 rounded-control text-left hover:bg-raised-hover disabled:opacity-60">
      <span className="w-8 h-8 rounded-control bg-surface-2 flex items-center justify-center text-text-2 flex-none">
        {busy ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Icon size={15} strokeWidth={1.75} />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] text-text">{label}</span>
        <span className="text-xs text-text-3">{hint}</span>
      </span>
    </button>
  );
}

function SyncRunRow({ run, first }: { run: SyncRunView; first: boolean }) {
  const failed = !!run.error;
  const pending = !run.finishedAt;
  const counts = [run.added && `+${run.added} added`, run.modified && `${run.modified} modified`, run.removed && `${run.removed} removed`].filter(Boolean).join(" · ");
  // Plaid's code ("ITEM_LOGIN_REQUIRED: …") is the useful part of the error.
  const detail = failed ? run.error!.split(":")[0] : pending ? "In progress" : counts || "No changes";
  return (
    <li className={cn("grid grid-cols-[10px_1fr_auto] gap-3 py-2 text-[13px] items-start", !first && "border-t border-border")}>
      <span className={cn("w-2 h-2 rounded-full mt-1.5", failed ? "bg-negative" : pending ? "bg-info" : "bg-positive")} />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-text">
          {KIND_LABEL[run.kind] ?? run.kind} <span className="text-text-3">· {run.trigger}</span>
        </span>
        <span className={cn("font-mono text-[11px] truncate", failed ? "text-negative" : "text-text-3")} title={run.error ?? undefined}>
          {detail}
        </span>
      </span>
      <span className="text-xs text-text-3 tabular whitespace-nowrap">{exactTime(run.startedAt)}</span>
    </li>
  );
}
