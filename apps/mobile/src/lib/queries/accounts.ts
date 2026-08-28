import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface AccountRow {
  id: string;
  name: string;
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
