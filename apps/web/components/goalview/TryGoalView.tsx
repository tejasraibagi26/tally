"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The sidebar's way in, for accounts that haven't tried the goal view.
 *
 * A link to Settings rather than a button that flips it: turning it on
 * changes two pages and the skin, so it should be a decision made where it
 * can also be undone, not a one-tap surprise.
 */
export function TryGoalView() {
  return (
    <Link
      href="/settings#display"
      className="mx-1 flex items-center justify-between gap-3 rounded-card border border-brand-border bg-brand-subtle px-3.5 py-2.5 text-left hover:border-brand"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[14.5px] font-semibold leading-tight text-text">Try the goal view</span>
        <span className="text-[12.5px] leading-tight text-text-2">Your spending, priced against your goal</span>
      </span>
      <ArrowRight size={16} strokeWidth={2} className="flex-none text-brand" aria-hidden="true" />
    </Link>
  );
}
