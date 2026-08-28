import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

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
