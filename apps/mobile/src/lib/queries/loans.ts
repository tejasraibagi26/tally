import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

/** One loan from GET /api/loans (apps/web/lib/loans.ts's LoanRow + its label). */
export interface LoanSummary {
  accountId: string;
  label: string;
  subtype: string | null;
  institutionName: string | null;
  /** What's owed, positive cents, in `currency`. */
  balance: number;
  currency: string;
  detail: {
    kind: string;
    interestRate: string | null;
    nextPaymentDueDate: string | null;
    nextPaymentAmount: number | null;
    isOverdue: boolean;
    payoffDate: string | null;
  } | null;
}

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: () => apiGet<{ loans: LoanSummary[] }>("/api/loans"),
  });
}
