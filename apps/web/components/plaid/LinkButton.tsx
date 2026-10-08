"use client";

import { Button } from "@/components/ui/Button";
import { SyncDialog } from "@/components/plaid/SyncDialog";
import { usePlaidLinkFlow } from "@/lib/usePlaidLinkFlow";

interface LinkButtonProps {
  mode: "create" | "update";
  itemId?: string;
  label: string;
  variant?: "primary" | "secondary";
  /** MOCK_MODE (server-computed, passed down) — skips real Plaid Link entirely. */
  mock?: boolean;
}

export function LinkButton({ mode, itemId, label, variant = "primary", mock = false }: LinkButtonProps) {
  const { start, startMock, loading, dialog, closeDialog, retry } = usePlaidLinkFlow(mode, itemId);

  return (
    <>
      <Button variant={variant} size={mode === "update" ? "sm" : "md"} loading={loading} onClick={mock && mode === "create" ? startMock : () => start()}>
        {label}
      </Button>
      <SyncDialog state={dialog} onClose={closeDialog} onRetry={mock && mode === "create" ? startMock : retry} />
    </>
  );
}
