import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";
import type { Forecast, ForecastRange } from "@tally/core/forecast";

/** GET /api/forecast (apps/web/lib/forecast.ts) — the same payload web renders. */
export interface ForecastAssumptions {
  dailySpendCents: number;
  source: "weekday_median" | "override" | "none";
  historyDays: number;
  paycheques: number;
  bills: number;
  cardsExcluded: string[];
  stale: { id: string; name: string }[];
  lumpy: string[];
}

export interface ForecastResult extends Forecast {
  assumptions: ForecastAssumptions;
  range: ForecastRange;
}

export function useForecast(days?: ForecastRange) {
  return useQuery({
    queryKey: ["forecast", days ?? "saved"],
    queryFn: () => apiGet<ForecastResult>(days ? `/api/forecast?days=${days}` : "/api/forecast"),
  });
}

export interface ForecastSettingsPatch {
  dailySpendCents?: number | null;
  days?: ForecastRange;
}

/** PATCH /api/forecast/settings, then the curve again. */
export function useSaveForecastSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ForecastSettingsPatch) => apiPatch<{ ok: true }>("/api/forecast/settings", patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forecast"] }),
  });
}
