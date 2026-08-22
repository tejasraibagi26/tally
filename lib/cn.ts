import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * clsx + tailwind-merge: when two classes set the same CSS property (e.g. a
 * default `border-border` and a caller-supplied `border-negative`), the
 * later one in argument order deterministically wins. Plain clsx doesn't
 * guarantee that — it depends on Tailwind's internal stylesheet order, not
 * className string order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
