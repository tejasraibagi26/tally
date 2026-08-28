import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";

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
  accountName?: string | null;
  accountMask?: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColorSlot: number | null;
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

export interface TransactionPatch {
  categoryId?: string | null;
  notes?: string | null;
  excluded?: boolean;
  reviewed?: boolean;
}

// Matches apps/web/components/transactions/TransactionDetailPanel.tsx's save()
// contract exactly (PATCH /api/transactions/[id]) -- splits/tags/
// alwaysCategorizeMerchant aren't editable from mobile yet.
export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: TransactionPatch) => apiPatch<TransactionRow>(`/api/transactions/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDeleteTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
