import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

export interface AccountProfile {
  name: string | null;
  email: string;
  birthDate: string | null;
  recapsEnabled: boolean;
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

// Matches apps/web/components/settings/SendTestRecapButton.tsx's contract
// exactly (POST /api/settings/recaps/test, session-authed, sends only to
// the caller) -- the test route skips the already-sent/no-activity checks
// the real monthly cron applies, so "skipped" here only ever means no
// accounts connected yet.
export interface TestRecapResult {
  ok: true;
  result: { status: "sent" | "skipped"; monthLabel: string };
}

export function useSendTestRecap() {
  return useMutation({
    mutationFn: () => apiPost<TestRecapResult>("/api/settings/recaps/test", {}),
  });
}

export function useWipeAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string }) => apiPost<{ ok: true; itemsRemoved: number }>("/api/account/wipe", body),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
