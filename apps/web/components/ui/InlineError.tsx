import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/** A failure next to what it's about: icon + text, announced (DESIGN.md §8, §12 -- never color alone). */
export function InlineError({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <p id={id} role="alert" className={cn("m-0 flex items-start gap-1.5 text-[13px] text-negative", className)}>
      <AlertTriangle size={14} strokeWidth={1.75} className="flex-none mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
