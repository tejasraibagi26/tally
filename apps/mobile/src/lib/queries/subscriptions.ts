import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet } from "@/lib/api";

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
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["recurring-streams"],
    queryFn: () => apiGet<{ streams: RecurringStream[] }>("/api/recurring"),
  });
}

// Only a manually-added bill (AddBillForm's web equivalent — isManual) can
// be removed; an auto-detected stream has no delete route since it'd just
// reappear on the next sync. Matches web's RemoveBillButton.tsx.
export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/recurring-streams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-streams"] });
    },
  });
}
