"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { usePlaidExchange } from "@/lib/usePlaidExchange";
import { savePlaidLinkSession, clearPlaidLinkSession } from "@/lib/plaidLinkSession";

/**
 * The token-fetch + Plaid Link open/onSuccess/onExit wiring shared by
 * LinkButton.tsx (renders its own visible button) and any other trigger
 * that needs to launch Link without owning that chrome itself — e.g.
 * ItemActionsMenu's "Add account", which opens the same update-mode Link
 * session (account_selection_enabled, see app/api/plaid/link-token/route.ts)
 * from a dropdown item instead of a standalone button.
 */
export function usePlaidLinkFlow(
  mode: "create" | "update",
  itemId?: string,
  /** Called once the flow ends: true after a successful exchange/resync, false on cancel or error. */
  onDone?: (ok: boolean, itemId: string | undefined) => void,
) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinct from `loading`: true only for the stretch after Plaid Link's
  // own modal has closed and the app is exchanging the token + pulling
  // data — see LinkButton.tsx's original comment on this.
  const [syncing, setSyncing] = useState(false);
  const onSuccessExchange = usePlaidExchange(mode, itemId);
  // One flow can serve many connections (the Accounts page's cards and Needs
  // you panel share it): start(itemId) picks the target, and `activeItemId`
  // tells callers which connection is mid-flow so only its button spins.
  const targetRef = useRef<string | undefined>(itemId);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback((ok: boolean) => {
    onDoneRef.current?.(ok, targetRef.current);
    setActiveItemId(undefined);
  }, []);

  const start = useCallback(async (itemIdOverride?: string) => {
    const target = itemIdOverride ?? itemId;
    targetRef.current = target;
    setActiveItemId(target);
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, itemId: target }),
      });
      if (!res.ok) throw new Error("Failed to create link token");
      const data = await res.json();
      // Persisted so app/plaid/oauth can resume the flow after an OAuth
      // institution redirect takes the user off this page entirely.
      savePlaidLinkSession({ linkToken: data.linkToken, mode, itemId: target });
      setLinkToken(data.linkToken);
    } catch (err) {
      console.error(err);
      setLoading(false);
      finish(false);
    }
  }, [mode, itemId, finish]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true);
      setSyncing(true);
      let ok = false;
      try {
        await onSuccessExchange(publicToken, metadata, targetRef.current);
        ok = true;
      } catch (err) {
        console.error(err);
        window.alert(
          mode === "create"
            ? "Something went wrong finishing the connection. If the account doesn't show up, try connecting again."
            : "Something went wrong syncing this account. It'll retry automatically, or try again."
        );
      } finally {
        clearPlaidLinkSession();
        setLoading(false);
        setSyncing(false);
        setLinkToken(null);
        finish(ok);
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        console.error("Plaid Link exited with error", err, metadata);
        window.alert("Connecting to your institution failed. Please try again.");
      }
      clearPlaidLinkSession();
      setLoading(false);
      setLinkToken(null);
      finish(false);
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return { start, loading, syncing, activeItemId };
}
