import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";

export interface FireDefaults {
  hasAccounts: boolean;
  investableNetWorth: number;
  defaultAnnualExpenses: number;
  defaultMonthlyContribution: number;
  /** Months of real history behind the defaults (max 12). Absent from older servers. */
  coveredMonths?: number;
  /** Investment accounts, converted to CAD, with whether each is left out. */
  accounts?: { id: string; name: string; value: number; excluded: boolean }[];
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
  /** Numeric string, like swr. Absent before migration 0022. */
  inflation?: string;
  excludedAccountIds?: string[];
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
    // The GET returns swr/expectedReturn as numeric strings (Postgres numeric);
    // the PUT takes numbers.
    mutationFn: (settings: {
      swr: number;
      expectedReturn: number;
      inflation: number;
      annualExpensesOverride: number | null;
      monthlyContributionOverride: number | null;
      excludedAccountIds: string[];
    }) => apiPut<{ settings: FireSettings }>("/api/fire", settings),
    // Autosave fires on every lever change, so this only refreshes defaults
    // (invested today depends on excluded accounts), not the settings the
    // screen is editing.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fire", "defaults"] }),
  });
}
