import { Skeleton } from "@/components/ui/Skeleton";

export default function TagsLoading() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
