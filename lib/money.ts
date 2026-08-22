/** Money is always integer cents on the server; these are display-only helpers. */

export function formatCents(cents: number, opts?: { signed?: boolean; abbreviate?: boolean }): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);

  if (opts?.abbreviate && abs >= 1000) {
    const [value, suffix] = abs >= 1_000_000 ? [dollars / 1_000_000, "M"] : [dollars / 1000, "K"];
    const sign = dollars < 0 ? "−" : "";
    return `${sign}$${Math.abs(value).toFixed(2)}${suffix}`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);

  if (dollars < 0) return `−${formatted}`;
  if (opts?.signed && dollars > 0) return `+${formatted}`;
  return formatted;
}

export function formatPercent(value: number): string {
  return value < 0.1 ? `${(value * 100).toFixed(1)}%` : `${Math.round(value * 100)}%`;
}
