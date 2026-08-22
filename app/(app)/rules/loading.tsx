import { Skeleton } from "@/components/ui/Skeleton";

export default function RulesLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-[160px]" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px]" />
        ))}
      </div>
    </div>
  );
}
