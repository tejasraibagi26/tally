"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { usePlaidExchange } from "@/lib/usePlaidExchange";
import { savePlaidLinkSession, clearPlaidLinkSession } from "@/lib/plaidLinkSession";

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
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinct from `loading`: true only for the stretch after Plaid Link's own
  // modal has closed and the app is exchanging the token + pulling initial
  // data — the gap that used to have zero feedback beyond a button that says
  // "Connecting…", which reads as stuck rather than working.
  const [syncing, setSyncing] = useState(false);
  const onSuccess = usePlaidExchange(mode, itemId);

  const connectMock = useCallback(async () => {
    setLoading(true);
    setSyncing(true);
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
      setLoading(false);
      setSyncing(false);
    }
  }, [router]);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, itemId }),
      });
      if (!res.ok) throw new Error("Failed to create link token");
      const data = await res.json();
      // Persisted so app/plaid/oauth can resume the flow after an OAuth
      // institution redirect takes the user off this page entirely.
      savePlaidLinkSession({ linkToken: data.linkToken, mode, itemId });
      setLinkToken(data.linkToken);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [mode, itemId]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true);
      setSyncing(true);
      try {
        await onSuccess(publicToken, metadata);
      } catch (err) {
        console.error(err);
        window.alert(
          mode === "create"
            ? "Something went wrong finishing the connection. If the account doesn't show up, try connecting again."
            : "Something went wrong syncing this account. It'll retry automatically, or try Reconnect again."
        );
      } finally {
        clearPlaidLinkSession();
        setLoading(false);
        setSyncing(false);
        setLinkToken(null);
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
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <>
      <Button
        variant={variant}
        size={mode === "update" ? "sm" : "md"}
        disabled={loading}
        onClick={mock ? connectMock : fetchToken}
      >
        {loading ? "Connecting…" : label}
      </Button>
      {syncing && (
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
