"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
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
  const router = useRouter();
  const [mockLoading, setMockLoading] = useState(false);
  const { start, loading, syncing } = usePlaidLinkFlow(mode, itemId);

  const connectMock = useCallback(async () => {
    setMockLoading(true);
    try {
      const res = await fetch("/api/mock/connect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to connect mock account");
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Failed to connect mock account");
    } finally {
      setMockLoading(false);
    }
  }, [router]);

  return (
    <>
      <Button
        variant={variant}
        size={mode === "update" ? "sm" : "md"}
        disabled={mock ? mockLoading : loading}
        onClick={mock ? connectMock : start}
      >
        {(mock ? mockLoading : loading) ? "Connecting…" : label}
      </Button>
      {(mockLoading || syncing) && (
        <LoadingOverlay
          message={
            mode === "create"
              ? "Connecting your account. Pulling transactions, balances, and more. This can take a moment."
              : "Reconnecting and syncing this account…"
          }
        />
      )}
    </>
  );
}
