"use client";

import { SyncDialog } from "@/components/plaid/SyncDialog";
import { usePlaidLinkFlow } from "@/lib/usePlaidLinkFlow";

/**
 * The classic LinkButton's Plaid flow (sign in again, or connect a new
 * account) in the new Tally's button style. The sync dialog is the same one.
 */
export function PlaidButton({ mode, itemId, label, tone = "solid", mock = false }: { mode: "create" | "update"; itemId?: string; label: string; tone?: "solid" | "coral"; mock?: boolean }) {
  const { start, startMock, loading, dialog, closeDialog, retry } = usePlaidLinkFlow(mode, itemId);
  const useMock = mock && mode === "create";
  return (
    <>
      <button type="button" className={`tn-btn ${tone === "coral" ? "tn-btn-coral" : "tn-btn-solid"}`} disabled={loading} onClick={useMock ? startMock : () => start()}>
        {loading ? "Opening…" : label}
      </button>
      <SyncDialog state={dialog} onClose={closeDialog} onRetry={useMock ? startMock : retry} />
    </>
  );
}
