import { Skeleton } from "@/components/ui/Skeleton";

export default function YearInReviewLoading() {
  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[220px] rounded-card" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
