import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * "Explore the demo" — a plain link to app/demo/route.ts, which creates the
 * read-only session and redirects to the Overview on the server. No client
 * sign-in call, so this works with JS disabled and the URL stays shareable
 * on its own (that route *is* the demo link).
 *
 * Render it only where the server has confirmed a demo exists, so it never
 * offers a door that isn't there.
 */
export function DemoCta({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      href="/demo"
      prefetch={false}
      className={cn(
        "h-11 px-5 inline-flex items-center justify-center gap-2 rounded-control text-[15px] font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info",
        variant === "primary"
          ? "bg-brand text-on-brand hover:bg-brand-hover"
          : "bg-surface border border-border-strong text-text hover:bg-sunken",
        className,
      )}
    >
      Explore the demo
      <ArrowRight size={16} strokeWidth={2} />
    </Link>
  );
}
