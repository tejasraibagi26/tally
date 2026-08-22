import { Skeleton } from "@/components/ui/Skeleton";

export default function InvestmentsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[100px]" />
      <Skeleton className="h-[140px]" />
      <Skeleton className="h-[220px]" />
    </div>
  );
}
