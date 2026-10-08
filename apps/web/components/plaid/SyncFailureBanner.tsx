"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FailureBanner, type FailureBannerItem } from "@/components/ui/FailureBanner";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";
import { runSync } from "@/lib/runSync";
import type { SyncProduct } from "@/lib/syncSteps";

/**
 * Renders full-width wherever it's mounted in the page — deliberately a
 * sibling of SyncButton rather than something SyncButton renders itself, so
 * the banner isn't confined to the button's own header-row flex slot (it
 * used to render squeezed next to "Manage rules →" instead of spanning the
 * page). SyncButton dispatches SYNC_RESULT_EVENT on completion, scoped to
 * whatever product(s) that page's button synced; this just listens for it,
 * and Try again re-runs that same sync.
 */
export function SyncFailureBanner() {
  const router = useRouter();
  const [items, setItems] = useState<FailureBannerItem[]>([]);
  const [runFailed, setRunFailed] = useState(false);
  const [products, setProducts] = useState<SyncProduct[] | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    function onResult(e: Event) {
      const detail = (e as CustomEvent<SyncResultEventDetail>).detail;
      setItems(detail.failedItems);
      setRunFailed(detail.runFailed ?? false);
      setProducts(detail.products ?? null);
    }
    window.addEventListener(SYNC_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SYNC_RESULT_EVENT, onResult);
  }, []);

  async function retry() {
    if (!products) return;
    setRetrying(true);
    // runSync's own result event replaces (or clears) what's shown here.
    await runSync(products);
    router.refresh();
    setRetrying(false);
  }

  return (
    <FailureBanner
      items={items}
      message={runFailed ? "Sync didn't run" : null}
      onRetry={products ? retry : undefined}
      retrying={retrying}
      onDismiss={() => {
        setItems([]);
        setRunFailed(false);
      }}
    />
  );
}
