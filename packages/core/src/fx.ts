/**
 * Currency conversion for the net worth aggregate only — every other number
 * in this app (account balances, holding values) stays labeled in its own
 * currency, never converted, per the app's general "show what it actually
 * is" philosophy. A single net worth figure can't honor that the same way:
 * summing raw USD and CAD cents together is not "unconverted," it's wrong,
 * so this is the one place a real FX rate is worth fetching.
 *
 * Rates come from Frankfurter (https://frankfurter.dev), a free, no-API-key
 * service built on the ECB's daily reference rates — a reasonable stand-in
 * for "mid-market" for a personal net worth snapshot, not a trading feed.
 */

export const NET_WORTH_CURRENCY = process.env.NET_WORTH_CURRENCY || "CAD";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // ECB rates only update once a day anyway; this just bounds how often we ask.

let cache: { base: string; fetchedAt: number; rates: Record<string, number> } | null = null;

/** `rates[CUR]` is how many units of CUR equal one unit of NET_WORTH_CURRENCY. */
async function getRates(): Promise<Record<string, number>> {
  if (cache && cache.base === NET_WORTH_CURRENCY && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${NET_WORTH_CURRENCY}`);
  if (!res.ok) throw new Error(`Frankfurter FX request failed: ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number> };
  cache = { base: NET_WORTH_CURRENCY, fetchedAt: Date.now(), rates: data.rates };
  return data.rates;
}

/**
 * Converts a cents amount from `currency` into NET_WORTH_CURRENCY. Falls
 * back to the unconverted amount if the currency is already the base, is
 * unrecognized by Frankfurter, or the rate fetch fails outright — a
 * transient FX outage should degrade net worth accuracy, not break it.
 */
export async function toNetWorthCurrency(cents: number, currency: string): Promise<number> {
  if (currency === NET_WORTH_CURRENCY) return cents;
  try {
    const rates = await getRates();
    const rate = rates[currency];
    if (!rate) return cents;
    return Math.round(cents / rate);
  } catch (err) {
    console.error(`FX rate fetch failed, using unconverted ${currency} amount`, err);
    return cents;
  }
}
