/**
 * The currency a security's market price is quoted in, derived from the
 * exchange it's listed on (ISO 10383 MIC) rather than from any
 * Plaid-reported currency label. Observed on Wealthsimple: VFV (a TSX ETF,
 * priced in CAD) came back labeled USD -- likely because it tracks the
 * S&P 500 -- so a CAD price got FX-converted as if it were USD, inflating
 * the holding ~39%. The listing exchange is the one fact that can't be
 * mislabeled that way. Null when the exchange is unknown, so callers fall
 * back to Plaid's own labels.
 */
const CAD_MICS = new Set(["XTSE", "XTSX", "XCNQ", "PURE", "NEOE", "NEOD", "NEON", "CHIC", "XCXD", "XATS", "OMGA", "LYNX"]);
const USD_MICS = new Set([
  "XNYS", "XNAS", "XNGS", "XNMS", "XNCM", "ARCX", "XASE", "BATS", "BATY", "EDGA", "EDGX",
  "IEXG", "XCHI", "XPHL", "XBOS", "MEMX", "EPRL", "OTCM",
]);

export function listingCurrency(mic: string | null | undefined, ticker: string | null | undefined): string | null {
  if (!mic) return null;
  const code = mic.toUpperCase();
  if (CAD_MICS.has(code)) {
    // TSX also lists USD-denominated share classes, conventionally suffixed
    // ".U" (e.g. VFV.U alongside VFV) -- same exchange, USD quotes.
    return ticker && /[.-]U$/i.test(ticker) ? "USD" : "CAD";
  }
  if (USD_MICS.has(code)) return "USD";
  return null;
}

/**
 * Which currency to store a holding's price/value in. When the price is the
 * security's own market price -- either because we fell back to it (the
 * institution reported $0) or because the institution's price is that same
 * quote -- it's denominated in the listing currency, whatever either Plaid
 * label says. Otherwise the institution priced it itself (possibly
 * converted into the account's currency), so its own label wins.
 */
export function holdingPriceCurrency(opts: {
  priceIsMarketPrice: boolean;
  mic: string | null | undefined;
  ticker: string | null | undefined;
  securityCurrency: string | null | undefined;
  holdingCurrency: string | null | undefined;
}): string {
  if (opts.priceIsMarketPrice) {
    return listingCurrency(opts.mic, opts.ticker) ?? opts.securityCurrency ?? opts.holdingCurrency ?? "USD";
  }
  return opts.holdingCurrency ?? opts.securityCurrency ?? "USD";
}
