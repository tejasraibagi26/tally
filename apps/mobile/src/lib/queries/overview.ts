import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { BudgetLine } from "@/lib/queries/budgets";

export interface UpcomingBill {
  type: "subscription" | "card";
  label: string;
  /** Cents. Null for a card payment whose bank reported no minimum (unknown, never zero). */
  amount: number | null;
  /** A card's last statement balance in cents, when sent. Absent from older servers. */
  statementBalance?: number | null;
  /** A card: paid toward that statement so far (transactions or the bank's record). Absent from older servers. */
  paidSoFar?: number | null;
  /** Past its due date, or a card the bank flags as past due. Absent from older servers. */
  overdue?: boolean;
  overdueDays?: number;
  dueDate: string;
  accountId: string | null;
  /** The recurring stream behind a "subscription" bill; null for a card payment. Absent from older servers. */
  streamId?: string | null;
  /** Tally guessed this bill from past charges, so the user can say it won't recur. Absent from older servers. */
  canDismiss?: boolean;
}

export interface OverviewResponse {
  month: string;
  netWorth: { assets: number; liabilities: number; net: number; asOfDate: string } | null;
  budgets: { totalBudgeted: number; totalSpend: number; remaining: number; categories: BudgetLine[] };
  upcomingBills: UpcomingBill[];
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
