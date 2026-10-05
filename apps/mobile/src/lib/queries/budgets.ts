import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiPost, apiFetch } from "@/lib/api";

export interface BudgetLine {
  categoryId: string;
  categoryName: string;
  /** Parent category name for grouping rows; null for a top-level category. */
  parentName: string | null;
  categoryColorSlot: number;
  /** Distinct per budget, server-assigned (@tally/core/budgetMath budgetColorSlots) -- color budget meters with this. */
  colorSlot?: number;
  amount: number;
  rolloverEnabled: boolean;
  rolloverFromPrior: number;
  isFixedAmount: boolean;
  spend: number;
  remaining: number;
}

export interface UnbudgetedSpend {
  categoryId: string;
  categoryName: string;
  spend: number;
}

export interface BudgetSetupSummary {
  copy: { fromMonth: string; count: number; total: number } | null;
  average: { count: number; total: number } | null;
}

export interface BudgetsResponse {
  month: string;
  budgets: BudgetLine[];
  /** Spend in categories no budget covers ("Not budgeted"). */
  unbudgeted: UnbudgetedSpend[];
  /** Only for a month with no budgets: the one-tap setup options. */
  setup: BudgetSetupSummary | null;
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
// (upsert by userId+month+categoryId). Also what an edit save calls --
// there's no separate update endpoint, it's the same upsert.
export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewBudget) => apiPut<{ budget: unknown }>("/api/budgets", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets", variables.month] });
    },
  });
}

export interface DeleteBudget {
  month: string;
  categoryId: string;
}

// Mirrors web's BudgetPanel.tsx "Remove budget" action -- DELETE /api/budgets by
// month+categoryId. apiDelete has no body param (nothing else needed one
// yet), so this goes through apiFetch directly, same as apiPut/apiPost do
// internally.
export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeleteBudget) => apiFetch<{ ok: true }>("/api/budgets", { method: "DELETE", body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets", variables.month] });
    },
  });
}

/** Fills an empty month: copy last month's budgets, or 3-month averages. */
export function useBudgetSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { month: string; source: "copy" | "average" }) => apiPost<{ ok: true; created: number }>("/api/budgets/setup", body),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ["budgets", v.month] }),
  });
}

export interface BudgetHistoryMonth {
  month: string;
  amount: number | null;
  spend: number;
}

/** Six months of one category's budget and spend, for the budget detail sheet. */
export function useBudgetHistory(categoryId: string | null, month: string) {
  return useQuery({
    queryKey: ["budgets", "history", categoryId, month],
    queryFn: () => apiGet<{ months: BudgetHistoryMonth[] }>(`/api/budgets/history?categoryId=${categoryId}&month=${month}`),
    enabled: !!categoryId,
  });
}
