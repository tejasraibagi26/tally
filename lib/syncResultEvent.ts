import type { FailureBannerItem } from "@/components/ui/FailureBanner";

/** Decouples SyncAllButton (fires this) from SyncFailureBanner (listens for it) so the banner isn't stuck rendering inside the button's own layout slot. */
export const SYNC_RESULT_EVENT = "tally:sync-result";

export interface SyncResultEventDetail {
  failedItems: FailureBannerItem[];
}
