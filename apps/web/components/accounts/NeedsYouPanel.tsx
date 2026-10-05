"use client";

import { formatCents } from "@tally/core/money";
import type { ConnectionState } from "@tally/core/connectionState";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { useConnectionActions } from "@/components/accounts/ConnectionActions";
import { ConnectionAvatar, StateButton } from "@/components/accounts/ConnectionCard";
import { toneBorder, toneText } from "@/components/accounts/connectionUi";
import type { ConnectionView } from "@/components/accounts/types";

/**
 * Every connection that needs a tap, each with its reason and its own fix,
 * above the card grid. Desktop has the width to explain each problem inline
 * (mobile links to a Fix sheet instead).
 */
export function NeedsYouPanel({ rows, onOpenPanel }: { rows: { item: ConnectionView; state: ConnectionState }[]; onOpenPanel: (itemId: string) => void }) {
  const { run } = useConnectionActions();
  const blocked = rows.some((r) => r.state.level === "blocked");
  const tone = blocked ? "negative" : "warning";
  // Money whose numbers can't be trusted right now -- the size of the problem.
  const affected = rows.reduce((sum, r) => sum + r.item.accounts.reduce((s, a) => s + Math.abs(a.currentBalance ?? 0), 0), 0);

  return (
    <Card className="overflow-hidden" style={{ borderColor: toneBorder(tone) }}>
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border">
        <h2 className={cn("m-0 text-[15px] font-semibold", toneText[tone])}>
          {rows.length} bank{rows.length === 1 ? " needs" : "s need"} you
        </h2>
        {affected > 0 && (
          <span className="text-[13px] text-text-3">
            <span className="tabular money">{formatCents(affected)}</span> in balances affected
          </span>
        )}
      </div>
      <ul className="m-0 p-0 list-none">
        {rows.map(({ item, state }, i) => (
          <li
            key={item.id}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_220px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-5 py-3",
              i > 0 && "border-t border-border",
            )}
          >
            <ConnectionAvatar name={item.institutionName} state={state} />
            <button type="button" onClick={() => onOpenPanel(item.id)} className="flex flex-col gap-0.5 min-w-0 text-left hover:underline decoration-text-3">
              <span className="text-[14px] font-semibold text-text truncate">{item.institutionName ?? "Unknown institution"}</span>
              <span className="text-xs text-text-3 truncate">
                {item.accounts.length} account{item.accounts.length === 1 ? "" : "s"} · {state.statusLine.toLowerCase()}
              </span>
            </button>
            <p className="m-0 text-[13px] leading-snug text-text-2 col-start-2 col-span-2 row-start-2 lg:col-start-auto lg:col-span-1 lg:row-start-auto">
              {state.notice && (
                <>
                  <span className={cn("font-semibold", toneText[state.tone])}>{state.notice.title.replace(/…$/, "")}.</span> {state.notice.body}
                </>
              )}
            </p>
            <div className="flex items-center gap-1.5 row-start-1 col-start-3 lg:row-start-auto lg:col-start-auto">
              {state.action && <StateButton action={state.action} tone={state.tone} pending={state.actionPending} onClick={() => run(item, state.action!)} />}
              {state.secondaryAction && <StateButton action={state.secondaryAction} tone={state.tone} onClick={() => run(item, state.secondaryAction!)} />}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
