import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

export interface AccountProfile {
  name: string | null;
  email: string;
  birthDate: string | null;
  recapsEnabled: boolean;
  /** One-time modals already dismissed (web lib/announcements.ts); missing on older servers. */
  seenAnnouncements?: string[];
  /** On the goal view (users.goal_view_at). Missing on older servers, which means off. */
  goalView?: boolean;
}

export function useAccountProfile() {
  return useQuery({
    queryKey: ["account"],
    queryFn: () => apiGet<AccountProfile>("/api/account"),
  });
}

export interface AccountPatch {
  name?: string;
  email: string;
  birthDate?: string | null;
  currentPassword: string;
}

// Matches apps/web/components/settings/AccountForm.tsx's save() contract --
// email/birthDate changes are password-gated server-side (PATCH /api/account).
export function useUpdateAccountProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AccountPatch) => apiPatch<{ ok: true; emailChanged: boolean; emailChangePending?: boolean }>("/api/account", patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account"] }),
  });
}

// Not bundled into useUpdateAccountProfile's PATCH /api/account (password-gated,
// for name/email/birthDate) -- this toggle is non-sensitive and hits its own
// PATCH /api/settings/recaps endpoint, same as the web app's RecapsToggle.
export function useUpdateRecaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => apiPatch<{ ok: true }>("/api/settings/recaps", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account"] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => apiPost<{ ok: true }>("/api/account/password", body),
  });
}

export function useWipeAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string }) => apiPost<{ ok: true; itemsRemoved: number }>("/api/account/wipe", body),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * The goal view, shared with web: one account setting, one column
 * (users.goal_view_at). Turning it on here turns it on there too, which is
 * the point -- it is how you read your money, not a per-device preference.
 */
export function useUpdateGoalView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => apiPatch<{ ok: true }>("/api/settings/goal-view", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
  });
}
