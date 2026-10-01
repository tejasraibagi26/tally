import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";

export type AlertType = "budget_threshold" | "connection_broken" | "large_transaction" | "subscription_change";

export interface AlertPreferences {
  channels: Record<AlertType, { email: boolean }>;
  largeTransactionCents: number;
}

export interface AlertHistoryItem {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
  email: { status: "sent" | "failed"; error?: string } | null;
}

export interface AlertPreferencesPatch {
  channels?: Partial<Record<AlertType, { email: boolean }>>;
  largeTransactionCents?: number;
}

// Same contract as web Settings → Alerts (apps/web/app/api/alerts/...).
// Alerts are email only (ALERTS.md: no push without an Apple Developer account).
export function useAlertPreferences() {
  return useQuery({
    queryKey: ["alertPreferences"],
    queryFn: () => apiGet<AlertPreferences>("/api/alerts/preferences"),
  });
}

export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AlertPreferencesPatch) => apiPatch<AlertPreferences>("/api/alerts/preferences", patch),
    // Optimistic: switches flip immediately and roll back on failure.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["alertPreferences"] });
      const prev = queryClient.getQueryData<AlertPreferences>(["alertPreferences"]);
      if (prev) {
        queryClient.setQueryData<AlertPreferences>(["alertPreferences"], {
          channels: { ...prev.channels, ...(patch.channels as AlertPreferences["channels"]) },
          largeTransactionCents: patch.largeTransactionCents ?? prev.largeTransactionCents,
        });
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["alertPreferences"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alertPreferences"] }),
  });
}

export function useAlertHistory(limit = 20) {
  return useQuery({
    queryKey: ["alertHistory", limit],
    queryFn: () => apiGet<{ alerts: AlertHistoryItem[] }>(`/api/alerts?limit=${limit}`),
  });
}
