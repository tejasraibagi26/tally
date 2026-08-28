import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";

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
export function exchangePublicToken(publicToken: string): Promise<{ ok: true; itemId: string; institutionName: string | null }> {
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
export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products: SyncProduct[]) => apiPost<{ ok: true; results: SyncResult[] }>("/api/sync", { products }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
