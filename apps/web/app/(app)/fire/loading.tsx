import { Skeleton } from "@/components/ui/Skeleton";

export default function FireLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-[100px]" />
      <Skeleton className="h-[420px]" />
    </div>
  );
}
