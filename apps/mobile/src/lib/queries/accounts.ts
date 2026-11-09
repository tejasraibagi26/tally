import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";

export interface AccountRow {
  id: string;
  name: string;
  // The real Plaid name and raw nickname, alongside `name` (already resolved
  // to nickname ?? realName by the server) -- needed to seed and label the
  // rename editor without re-deriving the fallback client-side.
  realName: string;
  nickname: string | null;
  mask: string | null;
  type: string;
  /** The effective kind (the user's override over Plaid's), resolved server-side. */
  subtype: string | null;
  /** Plaid's own tag and the user's retag; missing from servers older than web v2.24.0. */
  plaidSubtype?: string | null;
  subtypeOverride?: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

export type ItemBadge = "good" | "warning" | "serious" | "critical" | "syncing";

export interface Institution {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  badge: ItemBadge;
  /** Net across this connection's accounts, already signed (credit/loan
   * subtracted) and converted to `totals.currency` server-side -- the rows
   * below stay in their own currency, so this can't be summed client-side. */
  total: number;
  accounts: AccountRow[];
}

/** A bank the user disconnected: history kept, balances frozen and out of totals. */
export interface DisconnectedInstitution {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  disconnectedAt: string;
  accounts: { id: string; name: string; mask: string | null; type: string }[];
}

export interface AccountsResponse {
  institutions: Institution[];
  /** Missing from servers older than web v1.28.0. */
  disconnected?: DisconnectedInstitution[];
  unlinkedAccounts: AccountRow[];
  totals: { assets: number; liabilities: number; net: number; currency: string };
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiGet<AccountsResponse>("/api/accounts"),
  });
}

export function useUpdateAccountNickname(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string | null) => apiPatch<{ ok: true; nickname?: string | null }>(`/api/accounts/${accountId}`, { nickname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/** Retag a bank account's kind (checking / savings); null hands it back to the bank's tag. */
export function useUpdateAccountKind(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtypeOverride: string | null) => apiPatch<{ ok: true; subtypeOverride?: string | null }>(`/api/accounts/${accountId}`, { subtypeOverride }),
    onSuccess: () => {
      // The kind sets whether the balance counts as spending money.
      for (const key of ["accounts", "overview", "safe-to-spend", "safe-to-spend-settings", "forecast"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
