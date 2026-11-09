import { Skeleton } from "@/components/ui/Skeleton";

// The section's content only: the layout's header and menu stay on screen.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-card" />
      ))}
    </div>
  );
}
