import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";
import type { SafeToSpend } from "@tally/core/safeToSpend";
import type { Paycheque } from "@tally/core/paycheque";

/** GET /api/safe-to-spend (apps/web/lib/safeToSpend.ts). */
export interface SafeToSpendResult extends SafeToSpend {
  paycheque: Paycheque | null;
}

export function useSafeToSpend(enabled = true) {
  return useQuery({
    queryKey: ["safe-to-spend"],
    queryFn: () => apiGet<SafeToSpendResult>("/api/safe-to-spend"),
    enabled,
  });
}

export interface SafeToSpendSettingsPatch {
  cushion?: number;
  accounts?: Record<string, boolean | null>;
  dueDays?: Record<string, number | null>;
}

/** PUT /api/safe-to-spend/settings, then the number again. */
export function useSaveSafeToSpendSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SafeToSpendSettingsPatch) => apiPut<{ ok: true }>("/api/safe-to-spend/settings", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safe-to-spend"] });
      queryClient.invalidateQueries({ queryKey: ["safe-to-spend-settings"] });
    },
  });
}

/** GET /api/safe-to-spend/settings: what the Safe to spend screen edits. */
export interface SafeToSpendSettings {
  cushion: number;
  accounts: { id: string; label: string; kind: string; counts: boolean }[];
  cards: { id: string; label: string; dueDay: number | null }[];
}

export function useSafeToSpendSettings() {
  return useQuery({
    queryKey: ["safe-to-spend-settings"],
    queryFn: () => apiGet<SafeToSpendSettings>("/api/safe-to-spend/settings"),
  });
}
