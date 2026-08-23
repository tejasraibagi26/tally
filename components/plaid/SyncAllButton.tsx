"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";

interface SyncResult {
  itemId: string;
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

export function SyncAllButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
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
        {loading ? "Syncing…" : "Sync now"}
      </Button>
      {loading && <LoadingOverlay message="Syncing your connections — this can take a moment." />}
    </>
  );
}
