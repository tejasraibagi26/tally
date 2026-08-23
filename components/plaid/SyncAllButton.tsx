"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { FailureBanner, type FailureBannerItem } from "@/components/ui/FailureBanner";

interface SyncResult {
  itemId: string;
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

export function SyncAllButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failedItems, setFailedItems] = useState<FailureBannerItem[]>([]);

  async function handleSync() {
    setLoading(true);
    setFailedItems([]);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data: { results?: SyncResult[] } = await res.json();
      const failed = (data.results ?? [])
        .filter((r) => r.failures.length > 0)
        .map((r) => ({ institutionName: r.institutionName, labels: r.failures.map((f) => f.label) }));
      setFailedItems(failed);
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Sync failed to run. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" disabled={loading} onClick={handleSync} className="self-start">
        {loading ? "Syncing…" : "Sync now"}
      </Button>
      {loading && <LoadingOverlay message="Syncing your connections — this can take a moment." />}
      <FailureBanner items={failedItems} onDismiss={() => setFailedItems([])} />
    </div>
  );
}
