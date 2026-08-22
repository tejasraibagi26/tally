import { Skeleton } from "@/components/ui/Skeleton";

export default function TransactionsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 h-full min-h-0 flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[52px] flex-none" />
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px]" />
        ))}
      </div>
    </div>
  );
}
