import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface RecurringStream {
  id: string;
  merchantKey: string;
  description: string | null;
  averageAmount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
  status: "active" | "cancelled" | "at_risk";
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["recurring-streams"],
    queryFn: () => apiGet<{ streams: RecurringStream[] }>("/api/recurring"),
  });
}
