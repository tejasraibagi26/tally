import { Skeleton } from "@/components/ui/Skeleton";

export default function BudgetsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[90px]" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[64px]" />
        ))}
      </div>
    </div>
  );
}
