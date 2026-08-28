import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface CashFlowMonth {
  month: string;
  income: number;
  spend: number;
  cashFlow: number;
}

export function useCashFlowTrend(months: number) {
  return useQuery({
    queryKey: ["cashflow", months],
    queryFn: () => apiGet<{ months: CashFlowMonth[] }>(`/api/analytics/cashflow?months=${months}`),
  });
}
