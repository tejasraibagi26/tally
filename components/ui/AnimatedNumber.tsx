"use client";

import { formatCents } from "@/lib/money";
import { useCountUp } from "@/lib/useCountUp";

/** Counts up from 0 to `cents` on mount, formatted exactly like a static formatCents() value. */
export function AnimatedNumber({ cents, signed, className }: { cents: number; signed?: boolean; className?: string }) {
  const value = useCountUp(cents);
  return <span className={className}>{formatCents(value, { signed })}</span>;
}
