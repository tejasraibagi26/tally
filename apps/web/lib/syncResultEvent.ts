import type { FailureBannerItem } from "@/components/ui/FailureBanner";
import type { SyncProduct } from "@/lib/syncSteps";

/** Decouples SyncButton (fires this) from SyncFailureBanner (listens for it) so the banner isn't stuck rendering inside the button's own layout slot. */
export const SYNC_RESULT_EVENT = "tally:sync-result";

export interface SyncResultEventDetail {
  failedItems: FailureBannerItem[];
  /** The sync request itself failed, so nothing ran. */
  runFailed?: boolean;
  /** What was synced, so the banner's Try again can run the same sync. */
  products?: SyncProduct[];
}
