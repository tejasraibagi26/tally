"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";
import type { SyncProduct } from "@/lib/syncSteps";

interface SyncResult {
  itemId: string;
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

interface SyncButtonProps {
  /** Which product(s) to sync, across every item the user owns — scoped to whatever this page actually shows, so a failure banner here never mentions data this page doesn't display. */
  products: SyncProduct[];
  label?: string;
  loadingMessage?: string;
}

export function SyncButton({ products, label = "Sync now", loadingMessage = "Syncing your connections. This can take a moment." }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      if (!res.ok) throw new Error("Sync failed");
      const data: { results?: SyncResult[] } = await res.json();
      const failedItems = (data.results ?? [])
        .filter((r) => r.failures.length > 0)
        .map((r) => ({ institutionName: r.institutionName, labels: r.failures.map((f) => f.label) }));
      window.dispatchEvent(new CustomEvent<SyncResultEventDetail>(SYNC_RESULT_EVENT, { detail: { failedItems } }));
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Sync failed to run. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" disabled={loading} onClick={handleSync}>
        {loading ? "Syncing…" : label}
      </Button>
      {loading && <LoadingOverlay message={loadingMessage} />}
    </>
  );
}
