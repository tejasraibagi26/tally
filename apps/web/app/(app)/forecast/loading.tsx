import { Skeleton } from "@/components/ui/Skeleton";

export default function ForecastLoading() {
  return (
    <div className="ui-page flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[148px]" />
      <Skeleton className="h-[320px]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}
