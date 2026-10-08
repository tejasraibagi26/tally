import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiDelete } from "@/lib/api";

// Server-side only: builds a short-lived Link token. This is the only Plaid
// string that ever reaches the client (never an access_token) -- same
// contract the web app's LinkButton uses (app/api/plaid/link-token).
export function createLinkToken(mode: "create" | "update", itemId?: string): Promise<{ linkToken: string }> {
  return apiPost("/api/plaid/link-token", { mode, itemId });
}

// metadata is deliberately omitted: the native SDK's LinkSuccessMetadata
// shape (institution.id) doesn't match what the web SDK sends
// (institution.institution_id), and the server already looks up the
// institution authoritatively via Plaid's own /item/get call regardless --
// metadata there is only ever a fallback for when that lookup is unavailable.
export function exchangePublicToken(publicToken: string): Promise<{ ok: true; itemId: string; institutionName: string | null; failures: { product: string; label: string }[] }> {
  return apiPost("/api/plaid/exchange", { publicToken });
}

export type SyncProduct = "balances" | "transactions" | "holdings" | "investments" | "liabilities";

interface SyncResult {
  itemId: string;
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

// Matches apps/web/components/plaid/SyncButton.tsx's contract exactly --
// syncs every item the user owns for the given product(s), same
// POST /api/sync endpoint. Mobile's Accounts screen was missing this
// entirely (only had Reconnect for a fully-broken item), so a "needs
// sync"/stale connection had no manual CTA at all.
// Matches apps/web/app/api/items/[id]/refresh-balances/route.ts's contract
// exactly — lighter-weight than useSync (balances only, one item), backing
// the institution actions sheet's "Refresh balances" row.
// The item id is the mutation's variable (not part of its key) so one hook
// instance can refresh any connection -- the card, the actions sheet and the
// Fix sheet all start refreshes, and useItemRefreshStates reads them all back.
const refreshBalancesKey = ["refresh-item-balances"] as const;

export function useRefreshItemBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: refreshBalancesKey,
    mutationFn: (itemId: string) => apiPost<{ ok: true }>(`/api/items/${itemId}/refresh-balances`),
    onSettled: () => {
      // A failed refresh can still have flipped the item's status server-side.
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

/**
 * Every connection's latest per-item refresh, keyed by item id -- the
 * Accounts screen needs this for all cards at once (to sort them and fill the
 * Fix sheet), and a refresh can be started from the card, the actions sheet
 * or the Fix sheet, each with its own useMutation instance. Reading the
 * mutation cache by key prefix sees all of them.
 */
export function useItemRefreshStates(): Map<string, { refreshing: boolean; failed: boolean }> {
  const latest = useMutationState({
    filters: { mutationKey: refreshBalancesKey },
    select: (m) => ({ itemId: String(m.state.variables ?? ""), status: m.state.status }),
  });
  const byItem = new Map<string, { refreshing: boolean; failed: boolean }>();
  // Mutation cache order is creation order, so later entries win.
  for (const m of latest) byItem.set(m.itemId, { refreshing: m.status === "pending", failed: m.status === "error" });
  return byItem;
}

// Matches apps/web/app/api/items/[id]/route.ts's DELETE contract exactly —
// removes the item from Plaid (best-effort) and deletes everything locally
// tied to it. Backs the institution actions sheet's "Revoke connection" row.
export function useRevokeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiDelete<{ ok: true }>(`/api/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products: SyncProduct[]) => apiPost<{ ok: true; results: SyncResult[] }>("/api/sync", { products }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Prefix match -- covers both ["investments","holdings"] and
      // ["investments","transactions"] (see lib/queries/investments.ts).
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      // Credit cards read liabilities (balances, statements, due dates).
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    },
  });
}
