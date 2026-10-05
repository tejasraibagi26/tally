import { Skeleton } from "@/components/ui/Skeleton";

// Shape-matched to the page: header, chart hero beside the money-in and
// allocation column, then the holdings table.
export default function InvestmentsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-[340px]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[174px]" />
        </div>
      </div>
      <Skeleton className="h-[320px]" />
    </div>
  );
}
