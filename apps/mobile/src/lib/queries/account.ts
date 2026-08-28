import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

export interface AccountProfile {
  name: string | null;
  email: string;
  birthDate: string | null;
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
    mutationFn: (patch: AccountPatch) => apiPatch<{ ok: true; emailChanged: boolean }>("/api/account", patch),
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
