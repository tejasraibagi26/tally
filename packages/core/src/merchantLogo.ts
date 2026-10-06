/**
 * Which logo a transaction row shows. Plaid puts a merchant's logo on the
 * transaction (`logo_url`), and sometimes only on a counterparty; failing
 * both, another transaction from the same merchant may have one. The row
 * falls back to its first letter when none of them does.
 */

/** HTTPS image URL, or null -- anything else is never rendered. */
function cleanUrl(url: unknown): string | null {
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

/** The transaction's own logo, else the first merchant counterparty's, else any counterparty's. */
export function ownMerchantLogo(logoUrl: string | null | undefined, counterparties: unknown): string | null {
  const own = cleanUrl(logoUrl);
  if (own) return own;
  if (!Array.isArray(counterparties)) return null;
  const withLogo = counterparties.filter((c): c is { type?: unknown; logo_url?: unknown } => typeof c === "object" && c !== null && cleanUrl((c as { logo_url?: unknown }).logo_url) !== null);
  const merchant = withLogo.find((c) => c.type === "merchant") ?? withLogo[0];
  return merchant ? cleanUrl(merchant.logo_url) : null;
}

/** Lookup key for sharing a logo across one merchant's transactions. */
export function merchantLogoKey(merchantName: string | null | undefined): string | null {
  const key = merchantName?.trim().toLowerCase();
  return key ? key : null;
}
