import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface UtilizationResult {
  utilization: number | null;
  totalBalance: number;
  totalLimit: number;
  excludedCount: number;
}

// Only `utilization` is used today (Overview's credit-utilization KPI tile).
// `cards` exists (apps/web/lib/liabilities.ts's CreditCardRow, a nested
// shape including per-card liability fields) but nothing on mobile needs
// individual card detail yet -- left untyped here rather than guessed.
export function useLiabilities() {
  return useQuery({
    queryKey: ["liabilities"],
    queryFn: () => apiGet<{ cards: unknown[]; utilization: UtilizationResult }>("/api/liabilities"),
  });
}
