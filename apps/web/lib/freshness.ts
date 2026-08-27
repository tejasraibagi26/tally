/** WORK.md §8.3 freshness contract: Fresh < 6h · Stale 6–48h · Needs attention > 48h. */
export type FreshnessStatus = "good" | "warning" | "serious";

export function freshnessStatus(lastSyncedAt: Date | null): FreshnessStatus {
  if (!lastSyncedAt) return "serious";
  const hours = (Date.now() - lastSyncedAt.getTime()) / 3_600_000;
  if (hours < 6) return "good";
  if (hours <= 48) return "warning";
  return "serious";
}

/** Same badge status set as components/ui/StatusBadge.tsx's `Status` type
 * (not imported here to keep this file component-free — kept in sync by hand). */
export type ItemBadgeStatus = "good" | "warning" | "serious" | "critical" | "syncing";

// A broken item (needs re-auth) always reads "critical" regardless of how
// recently it last synced — otherwise the freshness badge follows §8.3.
// NOT_READY overrides freshness too: a sync that ran five minutes ago but
// came back empty because Plaid hasn't finished its initial pull would
// otherwise misleadingly read "good" even though there's no data yet.
// Shared by the Accounts page and GET /api/accounts (mobile) so the two
// surfaces can't disagree on what a connection's badge should say.
export function itemStatusToBadge(status: string, lastSyncedAt: Date | null, transactionsUpdateStatus: string | null): ItemBadgeStatus {
  if (status === "login_required" || status === "revoked" || status === "error") return "critical";
  if (status === "pending_expiration") return "warning";
  if (transactionsUpdateStatus === "NOT_READY") return "syncing";
  return freshnessStatus(lastSyncedAt);
}
