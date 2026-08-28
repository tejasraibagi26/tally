// Matches apps/web/components/transactions/TransactionsList.tsx's
// amountColorClass exactly: positive cents = income (green), negative = spend
// (red). Kept as one function so mobile and web can't quietly diverge.
export function amountColor(cents: number): string {
  if (cents > 0) return "#0F7A57";
  if (cents < 0) return "#B23A2C";
  return "#1A1917";
}
