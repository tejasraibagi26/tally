"use client";

import Link from "next/link";
import { Target } from "lucide-react";

/**
 * The sidebar's way into the goal view, for accounts that haven't turned it
 * on. A link to Settings rather than a switch: turning it on changes two
 * pages and the skin, so it should be a decision made where it can also be
 * undone.
 *
 * One row, in the same shape and height as the nav links above it. It was a
 * two-line bordered card, which pushed the sidebar past the ~800px window it
 * is sized to fit and made the whole thing scroll. The nav is the one place
 * in the app where a promo has to pay rent in pixels: the year-in-review
 * sticker gets away with being a card because it only appears in January.
 */
export function TryGoalView() {
  return (
    <Link
      href="/settings#display"
      className="flex items-center justify-between gap-2 rounded-control px-2.5 py-1.5 text-[15px] text-text-2 hover:bg-sunken"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Target size={17} strokeWidth={1.75} className="flex-none text-brand" aria-hidden="true" />
        <span className="truncate">Goal view</span>
      </span>
      <span className="flex-none rounded-badge bg-brand-subtle px-1.5 py-px text-[11px] font-medium text-brand">New</span>
    </Link>
  );
}
