import type { useThemeColors } from "@/theme/useThemeColors";

// Matches apps/web/components/transactions/TransactionsList.tsx's
// amountColorClass exactly: positive cents = income (green), negative = spend
// (red). Kept as one function so mobile and web can't quietly diverge. Takes
// the caller's theme colors (from useThemeColors) so the result follows
// light/dark instead of being pinned to the light hex values.
export function amountColor(cents: number, colors: ReturnType<typeof useThemeColors>): string {
  if (cents > 0) return colors.positive;
  if (cents < 0) return colors.negative;
  return colors.text;
}
