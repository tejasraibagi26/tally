import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";

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

// Any stream can be removed — a manually-added bill is hard deleted, an
// auto-detected stream is soft-deleted server-side so it stays gone even if
// the same charge keeps recurring. Matches web's RemoveBillButton.tsx.
export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/recurring-streams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-streams"] });
    },
  });
}
