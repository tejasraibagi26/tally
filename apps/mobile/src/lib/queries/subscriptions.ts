import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

export interface RecurringStream {
  id: string;
  merchantKey: string;
  description: string | null;
  averageAmount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
  status: "active" | "cancelled" | "at_risk";
  isManual: boolean;
  amortizeMonthly: boolean;
  /** Billing term a spread plan covers (3/6/9/12); absent from an older API response. */
  amortizeMonths?: number;
  /** When the person dismissed it ("This won't recur" or Remove); null for an active stream. */
  dismissedAt?: string | null;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["recurring-streams"],
    queryFn: () => apiGet<{ streams: RecurringStream[] }>("/api/recurring"),
  });
}

// Matches web's AmortizeToggle.tsx / PATCH /api/recurring-streams/[id] --
// toggling this on excludes the real (once-per-term) charge from budget
// spend and instead posts averageAmount / amortizeMonths as a synthetic
// transaction for each month of the term; amortizeMonths changes the term.
export function useSetAmortizeMonthly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; amortizeMonthly?: boolean; amortizeMonths?: number }) =>
      apiPatch<{ stream: RecurringStream }>(`/api/recurring-streams/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-streams"] }),
  });
}

/**
 * Streams the person dismissed, newest first, for Subscriptions' "Dismissed"
 * group. Filtered on dismissedAt as well, so a server that predates
 * ?dismissed=1 (and returns active streams) shows nothing rather than
 * listing active bills as dismissed.
 */
export function useDismissedSubscriptions() {
  return useQuery({
    queryKey: ["recurring-streams", "dismissed"],
    queryFn: () => apiGet<{ streams: RecurringStream[] }>("/api/recurring?dismissed=1"),
    select: (d) => d.streams.filter((s) => s.dismissedAt != null),
  });
}

/** Brings a dismissed stream back (PATCH { dismissed: false }); Undo and the Dismissed group's Restore. */
export function useRestoreSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<{ stream: RecurringStream }>(`/api/recurring-streams/${id}`, { dismissed: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-streams"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

// Any stream can be removed — a manually-added bill is hard deleted, an
// auto-detected stream is soft-deleted server-side so it stays gone even if
// the same charge keeps recurring. Matches web's RemoveBillButton.tsx.
export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/recurring-streams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-streams"] });
      // Overview's Upcoming list is built from the same streams.
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

// Matches web's AddBillForm.tsx / POST /api/recurring-streams -- a bill the
// recurring detector never picked up (rent prepaid in lump sums, etc.),
// created with manualNextDueDate already set. Amount is positive cents.
export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { description: string; accountId: string; categoryId: string | null; amount: number; manualNextDueDate: string }) =>
      apiPost<{ stream: RecurringStream }>("/api/recurring-streams", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-streams"] }),
  });
}
