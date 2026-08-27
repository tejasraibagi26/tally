import { cn } from "@/lib/cn";

// DESIGN.md §8: "shape-matched blocks in --sunken with a shimmer. Never a
// centered spinner on a full page." Uses Tailwind's built-in pulse animation
// rather than a custom sweep-gradient keyframe — same intent, less surface area.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-sunken", className)} />;
}
