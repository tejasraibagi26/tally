import { Skeleton } from "@/components/ui/Skeleton";

// Shape-matched to the page: header, the four-cell summary band, then a
// two-up card grid (header row + account rows each) -- nothing jumps when
// the real page streams in.
export default function AccountsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-[96px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[3, 3].map((rows, c) => (
          <div key={c} className="rounded-card border border-border bg-surface p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-[34px] h-[34px] rounded-[9px]" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="flex justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
