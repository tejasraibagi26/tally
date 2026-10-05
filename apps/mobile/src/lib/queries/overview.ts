import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { BudgetLine } from "@/lib/queries/budgets";

export interface UpcomingBill {
  type: "subscription" | "card";
  label: string;
  amount: number;
  dueDate: string;
  accountId: string | null;
}

export interface OverviewResponse {
  month: string;
  netWorth: { assets: number; liabilities: number; net: number; asOfDate: string } | null;
  budgets: { totalBudgeted: number; totalSpend: number; remaining: number; categories: BudgetLine[] };
  upcomingBills: UpcomingBill[];
  /** Unreviewed non-transfer transactions (the review queue's size, uncapped); absent from servers before this field shipped. */
  unreviewed?: number;
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
