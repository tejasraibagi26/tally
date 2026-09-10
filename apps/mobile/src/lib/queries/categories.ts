import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export interface Category {
  id: string;
  name: string;
  colorSlot: number;
  kind: "income" | "expense" | "transfer" | "ignore";
  parentId: string | null;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<{ categories: Category[] }>("/api/categories"),
    staleTime: 5 * 60_000,
  });
}

// Mirrors web's POST /api/categories call in AddBudgetForm.tsx.
export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind?: Category["kind"] }) => apiPost<{ category: Category }>("/api/categories", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
