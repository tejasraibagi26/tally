/** WORK.md §8.3 freshness contract: Fresh < 6h · Stale 6–48h · Needs attention > 48h. */
export type FreshnessStatus = "good" | "warning" | "serious";

export function freshnessStatus(lastSyncedAt: Date | null): FreshnessStatus {
  if (!lastSyncedAt) return "serious";
  const hours = (Date.now() - lastSyncedAt.getTime()) / 3_600_000;
  if (hours < 6) return "good";
  if (hours <= 48) return "warning";
  return "serious";
}
