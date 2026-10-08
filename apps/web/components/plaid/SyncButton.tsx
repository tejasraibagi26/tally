"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";
import { showToast } from "@/lib/toast";
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
}

/**
 * Doesn't block the page (DESIGN.md §8): the button shows a spinner beside
 * its label while the sync runs, success is a toast, and any failure goes
 * to the page's persistent SyncFailureBanner via SYNC_RESULT_EVENT.
 */
export function SyncButton({ products, label = "Sync now" }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function dispatch(detail: SyncResultEventDetail) {
    window.dispatchEvent(new CustomEvent<SyncResultEventDetail>(SYNC_RESULT_EVENT, { detail }));
  }

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
      const results = data.results ?? [];
      const failedItems = results
        .filter((r) => r.failures.length > 0)
        .map((r) => ({ institutionName: r.institutionName, labels: r.failures.map((f) => f.label) }));
      dispatch({ failedItems });
      if (failedItems.length === 0 && results.length > 0) showToast(results.length === 1 ? "Your bank is synced" : `All ${results.length} banks synced`);
      router.refresh();
    } catch (err) {
      console.error(err);
      dispatch({ failedItems: [], runFailed: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleSync}>
      {label}
    </Button>
  );
}
