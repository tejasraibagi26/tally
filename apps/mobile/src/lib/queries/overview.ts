import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { BudgetLine } from "@/lib/queries/budgets";

export interface OverviewResponse {
  month: string;
  netWorth: { assets: number; liabilities: number; net: number; asOfDate: string } | null;
  budgets: { totalBudgeted: number; totalSpend: number; remaining: number; categories: BudgetLine[] };
  /** Tally Pop's on-pace streak: finished days in a row under an even daily pace. Null with no budget; absent from older servers. */
  onPace?: { streak: number; dailyPace: number } | null;
}

export interface NetWorthPoint {
  asOfDate: string;
  net: number;
  assets: number;
  liabilities: number;
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => apiGet<OverviewResponse>("/api/analytics/overview"),
  });
}

export function useNetWorthTrend() {
  return useQuery({
    queryKey: ["networth-trend"],
    queryFn: () => apiGet<{ range: string; points: NetWorthPoint[] }>("/api/analytics/networth?range=12m"),
  });
}
