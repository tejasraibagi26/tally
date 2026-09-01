import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";

export interface IncomeSchedule {
  id: string;
  accountId: string;
  accountName: string | null;
  accountMask: string | null;
  categoryId: string | null;
  categoryName: string | null;
  label: string;
  amount: number;
  dayAnchors: number[];
  active: boolean;
}

// Matches apps/web/app/api/income-schedules/route.ts and .../[id]/route.ts
// exactly — same request/response shapes, same generate-on-write behavior
// server-side (backfilling this month's already-passed payday immediately
// rather than waiting for the nightly cron).
export function useIncomeSchedules() {
  return useQuery({
    queryKey: ["incomeSchedules"],
    queryFn: () => apiGet<{ schedules: IncomeSchedule[] }>("/api/income-schedules"),
  });
}

export interface NewIncomeSchedule {
  accountId: string;
  categoryId?: string | null;
  label: string;
  amount: number;
  dayAnchors: number[];
}

export function useCreateIncomeSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewIncomeSchedule) => apiPost<{ schedule: IncomeSchedule; generated: number }>("/api/income-schedules", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incomeSchedules"] }),
  });
}

export function useUpdateIncomeSchedule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<IncomeSchedule, "active" | "label" | "amount" | "dayAnchors" | "categoryId">>) =>
      apiPatch<{ schedule: IncomeSchedule; generated: number }>(`/api/income-schedules/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incomeSchedules"] }),
  });
}

export function useDeleteIncomeSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/income-schedules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incomeSchedules"] }),
  });
}
