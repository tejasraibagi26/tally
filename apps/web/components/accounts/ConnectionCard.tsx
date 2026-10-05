"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { ago, type ConnectionAction, type ConnectionState, type ConnectionTone } from "@tally/core/connectionState";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { AccountNicknameEditor } from "@/components/accounts/AccountNicknameEditor";
import { useConnectionActions } from "@/components/accounts/ConnectionActions";
import { accountKind, exactTime, initials, toneBorder, toneButton, toneDot, toneSubtle, toneText } from "@/components/accounts/connectionUi";
import type { AccountView, ConnectionView } from "@/components/accounts/types";

/** Healthy cards with more accounts than this show the first few plus "+N more". */
const PREVIEW_ROWS = 4;

export function StateButton({
  action,
  tone,
  pending,
  onClick,
}: {
  action: ConnectionAction;
  tone: ConnectionTone;
  pending?: boolean;
  onClick: () => void;
}) {
  // Remove is the one neutral button: an alternative to the fix, not the fix.
  const look = action.kind === "remove" ? toneButton.neutral : toneButton[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "h-8 px-3.5 rounded-full text-[13px] font-semibold flex-none inline-flex items-center justify-center min-w-[72px] transition-opacity hover:opacity-90",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:opacity-70",
        look,
      )}
    >
      {pending ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" aria-label="Working" /> : action.label}
    </button>
  );
}

export function StatusLine({ state, lastSyncedAt, className }: { state: ConnectionState; lastSyncedAt: string | null; className?: string }) {
  const color = state.level === "quiet" || state.busy ? "text-text-3" : toneText[state.tone];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", color, className)} title={lastSyncedAt ? `Last synced ${exactTime(lastSyncedAt)}` : "Never synced"}>
      {state.busy ? (
        <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-text-3 border-t-transparent animate-spin flex-none" />
      ) : (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-none", toneDot[state.tone])} />
      )}
      <span className="truncate">{state.statusLine}</span>
    </span>
  );
}

export function ConnectionAvatar({ name, state, size = 34 }: { name: string | null; state: ConnectionState; size?: number }) {
  const loud = state.level === "act" || state.level === "blocked";
  return (
    <span
      className={cn("flex-none rounded-[9px] flex items-center justify-center font-medium text-sm", loud ? cn(toneSubtle[state.tone], toneText[state.tone]) : "bg-brand-subtle text-brand")}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

/** The notice a state carries, with its action(s) inline on the right. */
export function StateNotice({ item, state, className }: { item: ConnectionView; state: ConnectionState; className?: string }) {
  const { run } = useConnectionActions();
  if (!state.notice) return null;
  return (
    <div
      className={cn("flex items-center gap-3 rounded-control border px-3.5 py-3", toneSubtle[state.tone], className)}
      style={{ borderColor: toneBorder(state.tone, 25) }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={cn("text-[13.5px] font-semibold", toneText[state.tone])}>{state.notice.title}</span>
        <span className="text-[13px] leading-snug text-text-2">{state.notice.body}</span>
        {state.tone === "info" && !state.action && (
          // Same indeterminate motion as LoadingOverlay (globals.css).
          <span className="relative mt-2 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: toneBorder("info", 30) }}>
            <span
              className="absolute top-0 h-full w-[35%] rounded-full bg-info motion-reduce:hidden"
              style={{ animation: "indeterminate-slide 1.8s cubic-bezier(.4,0,.2,1) infinite" }}
            />
          </span>
        )}
      </div>
      {state.action && (
        <div className="flex items-center gap-1.5 flex-none">
          <StateButton action={state.action} tone={state.tone} pending={state.actionPending} onClick={() => run(item, state.action!)} />
          {state.secondaryAction && <StateButton action={state.secondaryAction} tone={state.tone} onClick={() => run(item, state.secondaryAction!)} />}
        </div>
      )}
    </div>
  );
}

/**
 * One connection on the desktop Accounts grid: header (opens the bank
 * panel), at most one notice, account rows, and a footer pinned to the
 * bottom -- the card is a flex column that fills its grid cell, so paired
 * cards always share the taller one's height.
 */
export function ConnectionCard({
  item,
  state,
  baseCurrency,
  onOpenPanel,
}: {
  item: ConnectionView;
  state: ConnectionState;
  baseCurrency: string;
  onOpenPanel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const loud = state.level === "act" || state.level === "blocked";
  const accounts = item.accounts;
  const isCollapsed = !expanded && state.collapsed;
  const visible = isCollapsed ? [] : expanded ? accounts : accounts.slice(0, PREVIEW_ROWS);
  const hidden = accounts.length - visible.length;
  const canShrink = expanded && (state.collapsed || accounts.length > PREVIEW_ROWS);
  const mixedCurrency = accounts.some((a) => a.currency !== baseCurrency);
  const name = item.institutionName ?? "Unknown institution";

  return (
    <Card className="h-full flex flex-col overflow-hidden" style={loud ? { borderColor: toneBorder(state.tone) } : undefined}>
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onOpenPanel}
          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
          aria-label={`${name}: ${state.notice?.title ?? state.statusLine}. Open details`}
        >
          <ConnectionAvatar name={item.institutionName} state={state} />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-base text-text truncate">{name}</span>
            <StatusLine state={state} lastSyncedAt={item.lastSyncedAt} />
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenPanel}
          aria-label="Connection details and actions"
          title="Details and actions"
          className="w-7 h-7 flex-none flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <StateNotice item={item} state={state} className="mx-4 mb-3" />

      <div className="flex flex-col">
        {visible.map((a) => (
          <AccountRow key={a.id} account={a} dim={state.dimBalances} baseCurrency={baseCurrency} />
        ))}
      </div>

      {hidden > 0 && !isCollapsed && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 px-4 py-2.5 border-t border-border text-[13px] text-text-2 hover:bg-sunken text-left"
        >
          +{hidden} more account{hidden === 1 ? "" : "s"} <ChevronDown size={14} />
        </button>
      )}

      {/* mt-auto pins the footer to the bottom when the card is stretched to
          match a taller neighbour; the spare space goes above it. */}
      {accounts.length > 0 && (
        <div className={cn("mt-auto flex items-center justify-between gap-3 px-4 py-3 text-[13.5px]", (visible.length > 0 || hidden > 0) && "border-t border-border")}>
          {isCollapsed || canShrink ? (
            <button type="button" onClick={() => setExpanded(isCollapsed)} className="flex items-center gap-1 text-text-2 hover:text-text">
              {isCollapsed ? (
                <>
                  {accounts.length} account{accounts.length === 1 ? "" : "s"}
                  {state.dimBalances && ` · as of ${ago(item.lastSyncedAt)}`} <ChevronDown size={14} />
                </>
              ) : (
                <>
                  Show less <ChevronUp size={14} />
                </>
              )}
            </button>
          ) : state.dimBalances ? (
            <span className="text-text-2">Total as of {ago(item.lastSyncedAt)}</span>
          ) : (
            <Link href={`/transactions?account=${accounts.map((a) => a.id).join(",")}`} className="text-brand hover:underline">
              View transactions →
            </Link>
          )}
          <span className="flex items-baseline gap-1.5">
            <span className={cn("tabular money font-semibold", state.dimBalances ? "text-text-3" : "text-text")}>{formatCents(item.total)}</span>
            {/* Rows are labeled in their own currency, so a mixed-currency
                total would otherwise look like it disagrees with them. */}
            {mixedCurrency && <span className="text-[11px] text-text-3">{baseCurrency}</span>}
          </span>
        </div>
      )}
    </Card>
  );
}

function AccountRow({ account, dim, baseCurrency }: { account: AccountView; dim: boolean; baseCurrency: string }) {
  const foreign = account.currency !== baseCurrency;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-2.5 border-t border-border hover:bg-surface-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <AccountNicknameEditor accountId={account.id} name={account.realName} nickname={account.nickname} className={cn("text-[14.5px]", dim ? "text-text-2" : "text-text")} />
        <span className="font-mono text-xs text-text-3 truncate">
          {accountKind(account.type, account.subtype)}
          {account.mask ? ` · ····${account.mask}` : ""}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        {account.currentBalance == null ? (
          <>
            <span className="text-[15px] text-text-3">—</span>
            <span className="text-[11px] text-text-3">No balance from bank</span>
          </>
        ) : (
          <>
            <span className={cn("text-[15px] font-semibold tabular money", dim ? "text-text-3" : "text-text")}>{formatCents(account.currentBalance)}</span>
            {account.type === "credit" && account.creditLimit != null ? (
              <span className="text-[11px] text-text-3 tabular money">of {formatCents(account.creditLimit)}</span>
            ) : (
              foreign && <span className="text-[11px] text-text-3">{account.currency}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
