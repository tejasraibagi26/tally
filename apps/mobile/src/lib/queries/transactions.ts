import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";

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
  /** Category kind (expense/income/transfer) -- for refund detection. Absent from older servers. */
  categoryKind?: string | null;
  isTransfer?: boolean;
  /** "shortcut" for Apple Pay shortcut imports. */
  source?: string | null;
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
  recurringStreamId: string | null;
  /** Split term (3/6/9/12 months) of the stream this charge is spread by; null/absent when it isn't. */
  amortizeMonths?: number | null;
  splits: TransactionSplit[];
}

export interface TransactionsResponse {
  items: TransactionRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  dateRange: { from: string; to: string; isExplicit: boolean };
  /** Spend (positive cents) and unreviewed count for the whole filtered set; absent from servers before web v1.16. */
  summary?: { spend: number; unreviewed: number };
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
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

// Matches web's "Mark as annual subscription" (TransactionDetailPanel.tsx +
// POST /api/transactions/[id]/mark-annual) -- creates/updates a
// recurringStreams row with amortizeMonthly = true for this transaction's
// merchant/account, so its cost gets spread evenly across the months it
// covers (3, 6, 9 or 12 -- the plan's billing term) instead of hitting one
// month all at once.
export function useMarkAnnual(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (months: number) => apiPost<{ stream: { id: string }; generated: number }>(`/api/transactions/${id}/mark-annual`, { months }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-streams"] });
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

export interface NewTransaction {
  accountId: string;
  postedDate: string;
  name: string;
  // Cents, always positive -- kind decides the stored sign, matching
  // POST /api/transactions' contract exactly.
  amount: number;
  kind: "expense" | "income";
  categoryId?: string | null;
}

// For a purchase Plaid never saw -- cash, an unlinked account, or just
// something the user wants tracked right away. Mirrors web's
// AddTransactionForm.tsx (same endpoint, same isManual row it creates).
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewTransaction) => apiPost<{ transaction: TransactionRow }>("/api/transactions", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export interface ReviewItem {
  id: string;
  postedDate: string;
  merchantName: string | null;
  name: string;
  amount: number;
  accountName: string;
  categoryId: string | null;
  isPending: boolean;
  suggestions: { categoryId: string; name: string; colorSlot: number; reason: "current" | "history" }[];
}

/** The review queue (GET /api/transactions/review): unreviewed rows with category suggestions. */
export function useReviewQueue(enabled = true) {
  return useQuery({
    queryKey: ["transactions", "review"],
    queryFn: () => apiGet<{ total: number; items: ReviewItem[] }>("/api/transactions/review"),
    enabled,
  });
}

/**
 * Reviews one transaction: optionally sets its category (and, with
 * `always`, creates a rule for its merchant), and marks it reviewed.
 * Doesn't invalidate the queue itself -- the review screen walks a loaded
 * list and refreshes when it's done.
 */
export function useReviewTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId, always }: { id: string; categoryId: string | null; always?: boolean }) =>
      apiPatch(`/api/transactions/${id}`, categoryId ? { categoryId, reviewed: true, alwaysCategorizeMerchant: always || undefined } : { reviewed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"], predicate: (q) => q.queryKey[1] !== "review" });
      // Overview's "N to review" row counts the same queue.
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export type BulkAction = { type: "setCategory"; categoryId: string } | { type: "markReviewed" } | { type: "exclude"; value: boolean };

/** POST /api/transactions/bulk -- swipe actions on a list row use it with one id. */
export function useBulkTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[]; action: BulkAction }) => apiPost<{ ok: true; affected: number }>("/api/transactions/bulk", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}
