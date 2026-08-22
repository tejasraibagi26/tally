import { Skeleton } from "@/components/ui/Skeleton";

export default function OverviewLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-8 h-[220px]" />
        <Skeleton className="col-span-4 h-[220px]" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px]" />
        ))}
      </div>
      <Skeleton className="h-[240px]" />
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-7 h-[220px]" />
        <Skeleton className="col-span-5 h-[220px]" />
      </div>
    </div>
  );
}
