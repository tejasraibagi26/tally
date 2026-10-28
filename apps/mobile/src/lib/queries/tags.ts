import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { TagSummary } from "@tally/core/tagView";

/** GET /api/tags (apps/web/lib/tags.ts): every tag, most recently used first. */
export interface TagListItem {
  tag: string;
  count: number;
  spend: number;
  firstDate: string;
  lastDate: string;
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => apiGet<{ tags: TagListItem[] }>("/api/tags") });
}

/** GET /api/tags/[tag]: one tag added up (@tally/core/tagView). */
export function useTag(tag: string) {
  return useQuery({ queryKey: ["tags", tag], queryFn: () => apiGet<TagSummary>(`/api/tags/${encodeURIComponent(tag)}`), enabled: tag !== "" });
}
