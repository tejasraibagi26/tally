"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { SYNC_SUCCESS_HOLD_MS, accountCountLabel } from "@tally/core/syncDialog";
import { ExchangeError, handOffFailures, runPlaidExchange, type ExchangeResult } from "@/lib/usePlaidExchange";
import { savePlaidLinkSession, clearPlaidLinkSession } from "@/lib/plaidLinkSession";
import { showToast } from "@/lib/toast";
import type { SyncDialogState } from "@/components/plaid/SyncDialog";

/**
 * The token-fetch + Plaid Link open/onSuccess/onExit wiring shared by
 * LinkButton.tsx (renders its own visible button) and any other trigger
 * that needs to launch Link without owning that chrome itself — e.g.
 * ItemActionsMenu's "Add account", which opens the same update-mode Link
 * session (account_selection_enabled, see app/api/plaid/link-token/route.ts)
 * from a dropdown item instead of a standalone button.
 *
 * Also owns the SyncDialog's state for the stretch after Link's own modal
 * closes: syncing → success | partial | failed. The caller renders
 * <SyncDialog state={dialog} … /> with what this returns.
 */
export function usePlaidLinkFlow(
  mode: "create" | "update",
  itemId?: string,
  /** Called once the flow ends: true after a successful exchange/resync, false on cancel or error. */
  onDone?: (ok: boolean, itemId: string | undefined) => void,
) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinct from `loading`: true only for the stretch after Plaid Link's
  // own modal has closed and the app is exchanging the token + pulling data.
  const [syncing, setSyncing] = useState(false);
  const [dialog, setDialog] = useState<SyncDialogState | null>(null);
  // One flow can serve many connections (the Accounts page's cards and Needs
  // you panel share it): start(itemId) picks the target, and `activeItemId`
  // tells callers which connection is mid-flow so only its button spins.
  const targetRef = useRef<string | undefined>(itemId);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const metadataRef = useRef<PlaidLinkOnSuccessMetadata | null>(null);

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
      setDialog({ mode, phase: "failed", institutionName: null, accountTypes: [], failures: null, errorCode: "NETWORK", errorStage: "link", startedAt: Date.now() });
      finish(false);
    }
  }, [mode, itemId, finish]);

  // Runs the request that finishes a connection, driving the dialog. The
  // request is the exchange (create), the catch-up resync (update), or the
  // mock connect in MOCK_MODE.
  const runRequest = useCallback(
    async (request: () => Promise<ExchangeResult>, metadata: PlaidLinkOnSuccessMetadata | null) => {
      const institutionName = metadata?.institution?.name ?? null;
      const accountTypes = (metadata?.accounts ?? []).map((a) => a.type);
      setDialog({ mode, phase: "syncing", institutionName, accountTypes, failures: null, errorCode: null, errorStage: "save", startedAt: Date.now() });
      setLoading(true);
      setSyncing(true);
      let ok = false;
      try {
        const result = await request();
        ok = true;
        setDialog((d) =>
          d && {
            ...d,
            institutionName: result.institutionName ?? d.institutionName,
            failures: result.failures,
            phase: result.failures.length > 0 ? "partial" : "success",
          },
        );
        if (mode === "create") handOffFailures(result);
      } catch (err) {
        console.error(err);
        setDialog((d) => d && { ...d, phase: "failed", errorCode: err instanceof ExchangeError ? err.code : null });
      } finally {
        clearPlaidLinkSession();
        setLoading(false);
        setSyncing(false);
        setLinkToken(null);
        finish(ok);
      }
    },
    [mode, finish],
  );
  const exchange = useCallback(
    (publicToken: string, metadata: PlaidLinkOnSuccessMetadata | null) =>
      runRequest(() => runPlaidExchange(mode, publicToken, metadata, targetRef.current), metadata),
    [mode, runRequest],
  );

  /** MOCK_MODE's stand-in for the whole Link + exchange flow (create only). */
  const startMock = useCallback(() => {
    targetRef.current = undefined;
    void runRequest(async () => {
      const res = await fetch("/api/mock/connect", { method: "POST" }).catch(() => null);
      if (!res) throw new ExchangeError("NETWORK");
      if (!res.ok) throw new ExchangeError(null);
      return { institutionName: null, failures: [] };
    }, null);
  }, [runRequest]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      metadataRef.current = metadata;
      void exchange(publicToken, metadata);
    },
    onExit: (err, metadata) => {
      if (err) {
        console.error("Plaid Link exited with error", err, metadata);
        setDialog({
          mode,
          phase: "failed",
          institutionName: metadata.institution?.name ?? null,
          accountTypes: [],
          failures: null,
          errorCode: err.error_code ?? null,
          errorStage: "link",
          startedAt: Date.now(),
        });
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

  /** Closes the dialog; a finished connect then lands on Accounts. */
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const closeDialog = useCallback(() => {
    const d = dialogRef.current;
    if (d && d.mode === "create" && (d.phase === "success" || d.phase === "partial")) router.push("/accounts");
    if (d && d.phase !== "failed") router.refresh();
    setDialog(null);
  }, [router]);

  // A clean success holds briefly so it can be read, then closes itself.
  useEffect(() => {
    if (dialog?.phase !== "success") return;
    const { mode: m, institutionName, accountTypes } = dialog;
    const t = setTimeout(() => {
      closeDialog();
      if (m === "create") {
        showToast(`${institutionName ?? "Your bank"} connected${accountTypes.length > 0 ? ` · ${accountCountLabel(accountTypes.length)}` : ""}`);
      }
    }, SYNC_SUCCESS_HOLD_MS[m]);
    return () => clearTimeout(t);
  }, [dialog, closeDialog]);

  /** The failed dialog's primary action: a fresh Link session for a connect, a resync for a reconnect that got past sign-in. */
  const retry = useCallback(() => {
    const d = dialog;
    if (d?.mode === "update" && d.errorStage === "save") {
      setActiveItemId(targetRef.current);
      void exchange("", metadataRef.current);
      return;
    }
    setDialog(null);
    void start(targetRef.current);
  }, [dialog, exchange, start]);

  return { start, startMock, loading, syncing, activeItemId, dialog, closeDialog, retry };
}
