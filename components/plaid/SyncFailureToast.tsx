"use client";

import { useEffect, useState } from "react";
import { FailureBanner, type FailureBannerItem } from "@/components/ui/FailureBanner";
import { readAndClearSyncFailureHandoff } from "@/lib/syncFailureHandoff";

/** Mounted on the Accounts page — picks up a partial-sync-failure notice left by LinkButton/the OAuth redirect page across their navigation to here. */
export function SyncFailureToast() {
  const [item, setItem] = useState<FailureBannerItem | null>(null);

  useEffect(() => {
    const handoff = readAndClearSyncFailureHandoff();
    if (handoff) setItem({ institutionName: handoff.institutionName, labels: handoff.failures.map((f) => f.label) });
  }, []);

  if (!item) return null;
  return <FailureBanner items={[item]} onDismiss={() => setItem(null)} />;
}
