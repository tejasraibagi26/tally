import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import type { Cut, GoalProjection } from "@tally/core/goalMath";

/** GET /api/goals (apps/web/lib/goals.ts): the year-end goal, or { goal: null }. */
export interface GoalSummary {
  goal: { id: string; targetCents: number; startCents: number; startDate: string; deadline: string } | null;
  projection?: GoalProjection;
  cuts?: Cut[];
  /** The one-time announcement was dismissed (POST /api/goals/intro). Absent from older servers. */
  introSeen?: boolean;
}

export function useGoal(enabled = true) {
  return useQuery({
    queryKey: ["goal"],
    queryFn: () => apiGet<GoalSummary>("/api/goals"),
    enabled,
  });
}

export function useSaveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { targetCents: number; deadline?: string }) => apiPut<GoalSummary>("/api/goals", input),
    // Setting one also counts as seeing the announcement (the server records it).
    onSuccess: (data) => queryClient.setQueryData(["goal"], { ...data, introSeen: true }),
  });
}

export function useRemoveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<{ ok: true }>("/api/goals"),
    onSuccess: () => queryClient.setQueryData(["goal"], { goal: null, introSeen: true }),
  });
}
