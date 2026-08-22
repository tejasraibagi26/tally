import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-surface border border-border rounded-card shadow-raised", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  meta,
}: {
  title: string;
  action?: ReactNode;
  meta?: string;
}) {
  return (
    <div className="flex items-baseline justify-between px-5 py-[18px] border-b border-border">
      <h2 className="m-0 text-xl font-semibold text-text">{title}</h2>
      <div className="flex items-center gap-3">
        {meta && <span className="text-[13.5px] text-text-2 tabular">{meta}</span>}
        {action}
      </div>
    </div>
  );
}
