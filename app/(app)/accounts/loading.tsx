import { Skeleton } from "@/components/ui/Skeleton";

export default function AccountsLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[90px]" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}
