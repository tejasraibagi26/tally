"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionAction, LocalConnectionState } from "@tally/core/connectionState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { usePlaidLinkFlow } from "@/lib/usePlaidLinkFlow";

/** How long "You're reconnected" stays before the card goes quiet. */
const RECONNECTED_MS = 6000;

interface Target {
  id: string;
  institutionName: string | null;
}

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

  const run = useCallback(
    (target: Target, action: ConnectionAction) => {
      if (action.kind === "signIn") signIn(target.id);
      else if (action.kind === "refresh") void refresh(target.id);
      else setRemoveTarget(target);
    },
    [signIn, refresh],
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
    try {
      const res = await fetch(`/api/items/${removeTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      onRemoved?.(removeTarget.id);
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Couldn't revoke this connection. Please try again in a moment.");
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  const value = useMemo(() => ({ localFor, run, refresh, signIn, confirmRemove: setRemoveTarget }), [localFor, run, refresh, signIn]);
  const name = removeTarget?.institutionName ?? "this institution";

  return (
    <Ctx.Provider value={value}>
      {children}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        title={`Revoke ${name}?`}
        confirmLabel="Revoke connection"
        confirming={removing}
        description={
          <>
            <p className="m-0">This disconnects {name} from Plaid and permanently deletes everything locally tied to it:</p>
            <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
              <li>Every account under this connection</li>
              <li>All of their transaction history, balances, and holdings</li>
              <li>Any budgets or rules that reference those transactions won&apos;t be retroactively affected, but new transactions from here stop entirely</li>
            </ul>
            <p className="m-0 font-medium text-text">This cannot be undone. You&apos;d need to reconnect from scratch to get this data back.</p>
          </>
        }
      />
      {/* The resync after a successful sign-in pulls every product and can
          take a while; the card's own spinner can't explain that alone. */}
      {link.syncing && <LoadingOverlay message="Reconnecting and syncing this bank…" />}
    </Ctx.Provider>
  );
}
