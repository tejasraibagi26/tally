import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface BudgetLine {
  categoryId: string;
  categoryName: string;
  categoryColorSlot: number;
  amount: number;
  rolloverEnabled: boolean;
  rolloverFromPrior: number;
  isFixedAmount: boolean;
  spend: number;
  remaining: number;
}

export interface BudgetsResponse {
  month: string;
  budgets: BudgetLine[];
}

export function currentMonthParam(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => apiGet<BudgetsResponse>(`/api/budgets?month=${month}`),
  });
}
