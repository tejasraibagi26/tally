import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

export interface ApiToken {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// Matches apps/web/app/api/api-keys/route.ts and .../[id]/route.ts exactly --
// same personal access tokens used for the Apple Shortcuts intake endpoint
// (app/api/shortcuts/transactions), managed here or from web Settings, same
// bearer-token auth either surface already uses for everything else.
export function useApiTokens() {
  return useQuery({
    queryKey: ["apiTokens"],
    queryFn: () => apiGet<{ keys: ApiToken[] }>("/api/api-keys"),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiPost<{ apiKey: ApiToken; key: string }>("/api/api-keys", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiTokens"] }),
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiTokens"] }),
  });
}
