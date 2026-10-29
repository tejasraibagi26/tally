import { Skeleton } from "@/components/ui/Skeleton";

export default function ForecastLoading() {
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-5 lg:px-8 lg:py-7">
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
