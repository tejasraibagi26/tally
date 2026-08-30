import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";

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

export interface NewBudget {
  month: string;
  categoryId: string;
  amount: number; // cents
  rolloverEnabled: boolean;
  isFixedAmount: boolean;
}

// Mirrors web's AddBudgetForm.tsx -- same PUT /api/budgets contract
// (upsert by userId+month+categoryId).
export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewBudget) => apiPut<{ budget: unknown }>("/api/budgets", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets", variables.month] });
    },
  });
}
