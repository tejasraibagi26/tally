import { Skeleton } from "@/components/ui/Skeleton";

// Matches the page: header, the three summary figures, then the card table.
export default function CardsLoading() {
  return (
    <div className="ui-page flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[220px]" />
    </div>
  );
}
