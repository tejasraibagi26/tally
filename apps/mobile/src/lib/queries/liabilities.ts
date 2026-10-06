import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CardNetwork, CardView } from "@tally/core/cardView";
import { apiGet, apiPatch } from "@/lib/api";

export interface UtilizationResult {
  /** Σ balances ÷ Σ limits over cards with a known limit; null when none has one. */
  utilization: number | null;
  /** Both totals are in the net-worth currency and cover only the cards counted in the ratio. */
  totalBalance: number;
  totalLimit: number;
  /** Cards with no reported limit, left out of the ratio. */
  excludedCount: number;
}

/** One card from GET /api/liabilities (apps/web/lib/liabilities.ts's CreditCardRow + its cardView). */
export interface CreditCardSummary {
  accountId: string;
  name: string;
  nickname: string | null;
  mask: string | null;
  /** Cents in the card's own currency; positive is owed. */
  currentBalance: number;
  currency: string;
  creditLimit: number | null;
  creditLimitIsManual: boolean;
  itemId: string | null;
  institutionId: string | null;
  institutionName: string | null;
  connectionStatus: string | null;
  lastSyncedAt: string | null;
  network: CardNetwork | null;
  liability: {
    aprs: { apr_percentage: number; apr_type: string }[] | null;
    isOverdue: boolean;
    lastStatementBalance: number | null;
    lastStatementIssueDate: string | null;
    minimumPaymentAmount: number | null;
    nextPaymentDueDate: string | null;
  } | null;
  /** Statement-cycle view from @tally/core/cardView. Absent from servers before web v1.25.0. */
  view?: CardView;
}

export interface InstitutionBrand {
  name: string;
  color: string | null;
  /** data: URI of the bank's PNG logo. */
  logo: string | null;
}

export function useLiabilities() {
  return useQuery({
    queryKey: ["liabilities"],
    queryFn: () =>
      apiGet<{ cards: CreditCardSummary[]; institutions?: Record<string, InstitutionBrand>; utilization: UtilizationResult }>("/api/liabilities"),
  });
}

/** Sets (or, with null, removes) a limit you entered by hand -- PATCH /api/accounts/[id]. */
export function useSetCreditLimit(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (creditLimitDollars: number | null) => apiPatch<unknown>(`/api/accounts/${accountId}`, { creditLimit: creditLimitDollars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
