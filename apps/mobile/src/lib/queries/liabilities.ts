import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface UtilizationResult {
  /** Σ balances ÷ Σ limits over cards with a known limit; null when none has one. */
  utilization: number | null;
  /** Both totals are in the net-worth currency and cover only the cards counted in the ratio. */
  totalBalance: number;
  totalLimit: number;
  /** Cards with no reported limit, left out of the ratio. */
  excludedCount: number;
}

// Overview's Credit used figure reads `utilization` (balance, limit and the excluded count included).
// `cards` exists (apps/web/lib/liabilities.ts's CreditCardRow, a nested
// shape including per-card liability fields) but nothing on mobile needs
// individual card detail yet -- left untyped here rather than guessed.
/** The per-card fields the app reads; the server sends more (apps/web/lib/liabilities.ts's CreditCardRow). */
export interface CreditCardSummary {
  accountId: string;
  /** Cents in the card's own currency; positive is owed. */
  currentBalance: number;
  creditLimit: number | null;
}

export function useLiabilities() {
  return useQuery({
    queryKey: ["liabilities"],
    queryFn: () => apiGet<{ cards: CreditCardSummary[]; utilization: UtilizationResult }>("/api/liabilities"),
  });
}
