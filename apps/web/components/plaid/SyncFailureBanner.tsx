"use client";

import { useEffect, useState } from "react";
import { FailureBanner, type FailureBannerItem } from "@/components/ui/FailureBanner";
import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";

/**
 * Renders full-width wherever it's mounted in the page — deliberately a
 * sibling of SyncButton rather than something SyncButton renders itself, so
 * the banner isn't confined to the button's own header-row flex slot (it
 * used to render squeezed next to "Manage rules →" instead of spanning the
 * page). SyncButton dispatches SYNC_RESULT_EVENT on completion, scoped to
 * whatever product(s) that page's button synced; this just listens for it.
 */
export function SyncFailureBanner() {
  const [items, setItems] = useState<FailureBannerItem[]>([]);
  const [runFailed, setRunFailed] = useState(false);

  useEffect(() => {
    function onResult(e: Event) {
      const detail = (e as CustomEvent<SyncResultEventDetail>).detail;
      setItems(detail.failedItems);
      setRunFailed(detail.runFailed ?? false);
    }
    window.addEventListener(SYNC_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SYNC_RESULT_EVENT, onResult);
  }, []);

  return (
    <FailureBanner
      items={items}
      message={runFailed ? "Sync didn't run. Check your connection and try again." : null}
      onDismiss={() => {
        setItems([]);
        setRunFailed(false);
      }}
    />
  );
}
