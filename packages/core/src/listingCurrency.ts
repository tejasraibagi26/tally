import { DEFAULT_CURRENCY } from "./fx";

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
  "IEXG", "XCHI", "XPHL", "XBOS", "MEMX", "EPRL",
]);
/**
 * US over-the-counter venues. A Canadian security's OTC twin (VFV on the TSX
 * vs VFVXF on OTC) shares its ISIN, and Plaid resolved Wealthsimple's VFV to
 * that twin -- mic OOTC, labeled USD -- while its close_price was still the
 * TSX quote in CAD (193.11), so the holding got converted as USD, ~38% too
 * large. An OTC listing says nothing reliable about the quote currency, so
 * it's treated as unknown and the holding's own label decides (see
 * holdingPriceCurrency). OTCM used to be counted as USD for the same reason
 * it's wrong here.
 */
const OTC_MICS = new Set(["OOTC", "OTCM", "OTCB", "OTCQ", "PINX", "PSGM", "XOTC"]);

export function isOtcMic(mic: string | null | undefined): boolean {
  return !!mic && OTC_MICS.has(mic.toUpperCase());
}

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
 * Whether an institution-reported price is the security's market quote
 * (same currency, just a slightly different timestamp) rather than a price
 * the institution converted into another currency. Day-to-day and
 * intraday drift between the two is a few percent at most, while a USD/CAD
 * conversion moves the number ~27-39% -- so a relative band between those
 * separates them without needing either quote to match to the cent.
 */
export function isMarketQuote(institutionPrice: number | null | undefined, closePrice: number | null | undefined): boolean {
  if (institutionPrice == null || closePrice == null || closePrice <= 0 || institutionPrice <= 0) return false;
  return Math.abs(institutionPrice / closePrice - 1) < 0.15;
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
    // Plaid matched an OTC cross-listing: the security's own label is the
    // twin's (USD), so fall to the holding's label, which follows the
    // account the position is actually held in.
    if (isOtcMic(opts.mic)) return opts.holdingCurrency ?? opts.securityCurrency ?? DEFAULT_CURRENCY;
    return listingCurrency(opts.mic, opts.ticker) ?? opts.securityCurrency ?? opts.holdingCurrency ?? DEFAULT_CURRENCY;
  }
  return opts.holdingCurrency ?? opts.securityCurrency ?? DEFAULT_CURRENCY;
}
