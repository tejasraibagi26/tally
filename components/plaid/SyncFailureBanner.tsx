"use client";

import { useEffect, useState } from "react";
import { FailureBanner, type FailureBannerItem } from "@/components/ui/FailureBanner";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";

/**
 * Renders full-width wherever it's mounted in the page — deliberately a
 * sibling of SyncAllButton rather than something SyncAllButton renders
 * itself, so the banner isn't confined to the button's own header-row flex
 * slot (it used to render squeezed next to "Manage rules →" instead of
 * spanning the page). SyncAllButton dispatches SYNC_RESULT_EVENT on
 * completion; this just listens for it.
 */
export function SyncFailureBanner() {
  const [items, setItems] = useState<FailureBannerItem[]>([]);

  useEffect(() => {
    function onResult(e: Event) {
      const detail = (e as CustomEvent<SyncResultEventDetail>).detail;
      setItems(detail.failedItems);
    }
    window.addEventListener(SYNC_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SYNC_RESULT_EVENT, onResult);
  }, []);

  return <FailureBanner items={items} onDismiss={() => setItems([])} />;
}
