import { SYNC_RESULT_EVENT, type SyncResultEventDetail } from "@/lib/syncResultEvent";
import { showToast } from "@/lib/toast";
import type { SyncProduct } from "@/lib/syncSteps";

interface SyncResult {
  itemId: string;
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

/**
 * One manual sync of the given products across every connected bank, shared
 * by SyncButton and the failure banner's Try again. Success is a toast;
 * failures go out as SYNC_RESULT_EVENT for the page's SyncFailureBanner.
 * Resolves true when everything came through.
 */
export async function runSync(products: SyncProduct[]): Promise<boolean> {
  const dispatch = (detail: SyncResultEventDetail) => window.dispatchEvent(new CustomEvent<SyncResultEventDetail>(SYNC_RESULT_EVENT, { detail }));
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
    dispatch({ failedItems, products });
    if (failedItems.length === 0 && results.length > 0) showToast(results.length === 1 ? "Your bank is synced" : `All ${results.length} banks synced`);
    return failedItems.length === 0;
  } catch (err) {
    console.error(err);
    dispatch({ failedItems: [], runFailed: true, products });
    return false;
  }
}
