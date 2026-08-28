import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface TransactionSplit {
  categoryId: string;
  amount: number;
  note: string | null;
}

export interface TransactionRow {
  id: string;
  postedDate: string;
  merchantName: string | null;
  name: string;
  isPending: boolean;
  accountId: string;
  categoryId: string | null;
  categorySource: string | null;
  pfcDetailed: string | null;
  amount: number;
  currency: string;
  reviewed: boolean;
  notes: string | null;
  tags: string[] | null;
  excludedFromBudget: boolean;
  locationLabel: string | null;
  plaidTransactionId: string | null;
  isManual: boolean;
  splits: TransactionSplit[];
}

export interface TransactionsResponse {
  items: TransactionRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  dateRange: { from: string; to: string; isExplicit: boolean };
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ["transaction", id],
    enabled: Boolean(id),
    queryFn: () => apiGet<TransactionRow>(`/api/transactions/${id}`),
  });
}

export function useTransactions(filters: Record<string, string> = {}) {
  return useInfiniteQuery({
    queryKey: ["transactions", filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ ...filters, page: String(pageParam) });
      return apiGet<TransactionsResponse>(`/api/transactions?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined),
  });
}
