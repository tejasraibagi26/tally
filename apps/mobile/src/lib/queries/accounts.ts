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
  subtype: string | null;
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
  accounts: AccountRow[];
}

export interface AccountsResponse {
  institutions: Institution[];
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
