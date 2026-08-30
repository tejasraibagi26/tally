import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface BreakdownRow {
  key: string;
  label: string;
  colorSlot: number;
  total: number; // cents, positive
}

// Web's /api/analytics/categories — §9 "Spending by category," expense-kind,
// non-transfer, non-excluded, ranked by total for the current month.
export function useCategoryBreakdown() {
  return useQuery({
    queryKey: ["category-breakdown"],
    queryFn: () => apiGet<{ month: string; groupBy: string; rows: BreakdownRow[] }>("/api/analytics/categories"),
  });
}
