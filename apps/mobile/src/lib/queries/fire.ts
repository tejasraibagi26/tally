import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";

export interface FireDefaults {
  hasAccounts: boolean;
  investableNetWorth: number;
  defaultAnnualExpenses: number;
  defaultMonthlyContribution: number;
  birthDate: string | null;
  today: string;
}

export function useFireDefaults() {
  return useQuery({
    queryKey: ["fire", "defaults"],
    queryFn: () => apiGet<FireDefaults>("/api/fire/defaults"),
  });
}

export interface FireSettings {
  swr: string;
  expectedReturn: string;
  annualExpensesOverride: number | null;
  monthlyContributionOverride: number | null;
}

export function useFireSettings() {
  return useQuery({
    queryKey: ["fire", "settings"],
    queryFn: () => apiGet<{ settings: FireSettings | null }>("/api/fire"),
  });
}

export function useSaveFireSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: FireSettings) => apiPut<{ settings: FireSettings }>("/api/fire", settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fire", "settings"] }),
  });
}
