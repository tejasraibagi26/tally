"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionAction, LocalConnectionState } from "@tally/core/connectionState";
import { Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SyncDialog } from "@/components/plaid/SyncDialog";
import { usePlaidLinkFlow } from "@/lib/usePlaidLinkFlow";
import { showToast } from "@/lib/toast";

/** How long "You're reconnected" stays before the card goes quiet. */
const RECONNECTED_MS = 6000;

interface Target {
  id: string;
  institutionName: string | null;
  /** Listed by name in the disconnect confirm, when the caller has them. */
  accounts?: { id: string; name: string; mask: string | null }[];
}

/** Rows the disconnect confirm lists before collapsing the rest into "and N more". */
const REVOKE_LIST_MAX = 6;

interface ConnectionActionsValue {
  /** This device's in-flight state for a connection, layered over the server's. */
  localFor: (itemId: string) => LocalConnectionState;
  run: (target: Target, action: ConnectionAction) => void;
  refresh: (itemId: string) => void;
  /** Update-mode Plaid Link: re-auth, renew, or change which accounts Tally sees. */
  signIn: (itemId: string) => void;
  confirmRemove: (target: Target) => void;
}

const Ctx = createContext<ConnectionActionsValue | null>(null);

export function useConnectionActions(): ConnectionActionsValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useConnectionActions must be used inside ConnectionActionsProvider");
  return value;
}

/**
 * Every connection action on the Accounts page (card notices, the Needs you
 * panel, the bank panel) goes through here, so one Plaid Link flow serves
 * every card and only the card being fixed shows a spinner.
 */
export function ConnectionActionsProvider({
  serverRefreshFailed,
  onRemoved,
  children,
}: {
  /** Items whose latest manual sync_runs row failed -- the "retry didn't work" escalation. */
  serverRefreshFailed: string[];
  onRemoved?: (itemId: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const [justReconnected, setJustReconnected] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState<ReadonlySet<string>>(new Set());
  // This session's refresh outcomes override the server's until the next
  // render of fresh data catches up.
  const [refreshOutcome, setRefreshOutcome] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [removeTarget, setRemoveTarget] = useState<Target | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const onLinkDone = useCallback((ok: boolean, itemId: string | undefined) => {
    if (!ok || !itemId) return;
    setJustReconnected((prev) => new Set(prev).add(itemId));
    setRefreshOutcome((prev) => new Map(prev).set(itemId, true));
    setTimeout(() => {
      setJustReconnected((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, RECONNECTED_MS);
  }, []);
  const link = usePlaidLinkFlow("update", undefined, onLinkDone);
  const linkingId = link.loading || link.syncing ? link.activeItemId : undefined;

  const refresh = useCallback(
    async (itemId: string) => {
      setRefreshing((prev) => new Set(prev).add(itemId));
      let ok = false;
      try {
        const res = await fetch(`/api/items/${itemId}/refresh-balances`, { method: "POST" });
        ok = res.ok;
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshOutcome((prev) => new Map(prev).set(itemId, ok));
        setRefreshing((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        // A failed refresh can still have changed the item's status server-side.
        router.refresh();
      }
    },
    [router],
  );

  const startLink = link.start;
  const signIn = useCallback((itemId: string) => void startLink(itemId), [startLink]);

  const openRemove = useCallback((target: Target) => {
    setRemoveError(null);
    setRemoveTarget(target);
  }, []);

  const run = useCallback(
    (target: Target, action: ConnectionAction) => {
      if (action.kind === "signIn") signIn(target.id);
      else if (action.kind === "refresh") void refresh(target.id);
      else openRemove(target);
    },
    [signIn, refresh, openRemove],
  );

  const serverFailed = useMemo(() => new Set(serverRefreshFailed), [serverRefreshFailed]);
  const localFor = useCallback(
    (itemId: string): LocalConnectionState => ({
      refreshing: refreshing.has(itemId),
      linking: linkingId === itemId,
      justReconnected: justReconnected.has(itemId),
      refreshFailed: refreshOutcome.has(itemId) ? !refreshOutcome.get(itemId) : serverFailed.has(itemId),
    }),
    [refreshing, linkingId, justReconnected, refreshOutcome, serverFailed],
  );

  async function remove() {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/items/${removeTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      onRemoved?.(removeTarget.id);
      showToast(`${removeTarget.institutionName ?? "Bank"} disconnected. History kept`);
      setRemoveTarget(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      // Stays open with the failure in place of the description.
      setRemoveError(`Couldn't disconnect ${removeTarget.institutionName ?? "this bank"}. Check your connection and try again.`);
    } finally {
      setRemoving(false);
    }
  }

  const value = useMemo(() => ({ localFor, run, refresh, signIn, confirmRemove: openRemove }), [localFor, run, refresh, signIn, openRemove]);
  const name = removeTarget?.institutionName ?? "this institution";
  const accounts = removeTarget?.accounts ?? [];

  return (
    <Ctx.Provider value={value}>
      {children}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        title={`Disconnect ${name}?`}
        subtitle="Your history stays"
        icon={<Unplug size={20} strokeWidth={1.75} />}
        confirmLabel="Disconnect"
        confirming={removing}
        error={removeError}
        description={
          <>
            <p className="m-0">
              Tally removes its access to {name} through Plaid and stops syncing. Past transactions stay and keep counting in spending and budgets.
            </p>
            {accounts.length > 0 && (
              <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-2 p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-text-2">Stops updating</span>
                {accounts.slice(0, REVOKE_LIST_MAX).map((a) => (
                  <div key={a.id} className="flex justify-between gap-3 text-[13.5px] text-text">
                    <span className="truncate">{a.name}</span>
                    {a.mask && <span className="font-mono text-[12.5px] text-text-3 flex-none">····{a.mask}</span>}
                  </div>
                ))}
                {accounts.length > REVOKE_LIST_MAX && <span className="text-[13px] text-text-3">and {accounts.length - REVOKE_LIST_MAX} more</span>}
              </div>
            )}
            <p className="m-0 text-[13px] text-text-3">
              Balances leave your net worth. Connect {name} again any time and Tally picks up where it left off. To delete the data instead, use Wipe all data in Settings.
            </p>
          </>
        }
      />
      <SyncDialog state={link.dialog} onClose={link.closeDialog} onRetry={link.retry} />
    </Ctx.Provider>
  );
}
