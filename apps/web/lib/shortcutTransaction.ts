import { accountDisplayName } from "@tally/core/accountName";

/**
 * Turns the loose, human-typed strings an Apple Shortcut hands over (lifted
 * straight from an Apple Pay/Wallet transaction notification -- currency
 * symbols, "Sep 19, 2026 at 7:43 PM", a card's display name) into the exact
 * shape app/api/shortcuts/transactions/route.ts needs to insert a row.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parses "$16.95", "CA$16.95", "-$5.00", "1,234.56" into signed cents.
 * Returns null if no number could be found at all. */
export function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim();
  const isNegative = /^-|\(.*\)$/.test(trimmed); // leading "-" or accounting-style "(5.00)"
  const numeric = trimmed.replace(/[^0-9.]/g, "");
  if (!numeric) return null;
  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return isNegative ? -cents : cents;
}

/** Parses "Sep 19, 2026 at 7:43 PM" (or "September 19, 2026", or any
 * Date-parseable string) into a "YYYY-MM-DD" posted date. Deliberately
 * ignores the time-of-day and never converts through a timezone -- the
 * Shortcut already reports the phone's local calendar date, and re-deriving
 * it via `Date` would risk shifting it a day depending on server TZ. */
export function parseShortcutDate(raw: string): string | null {
  const trimmed = raw.trim();
  const named = trimmed.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (named) {
    const [, monthName, dayStr, yearStr] = named as [string, string, string, string];
    const month = MONTHS[monthName.slice(0, 3).toLowerCase()];
    if (month) {
      const day = Number.parseInt(dayStr, 10);
      const year = Number.parseInt(yearStr, 10);
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }
  const isoLike = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return `${y}-${m}-${d}`;
  }

  // Fallback: let the runtime parse it, then read the date parts back with
  // the SAME (non-UTC) getters in the SAME process -- self-consistent
  // regardless of what timezone the server happens to be running in.
  const parsed = new Date(trimmed.replace(/\bat\b/i, ""));
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = parsed.getMonth() + 1;
  const d = parsed.getDate();
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

export interface MatchableAccount {
  id: string;
  name: string;
  nickname: string | null;
  officialName: string | null;
  mask: string | null;
  currency: string;
}

// Apple Wallet's own display name for a card is rarely the bank's exact
// account name -- "TD First Class Travel Card" vs. the account named "TD
// First Class Travel Visa" -- so plain substring matching misses real
// matches. "card" is the one word Apple appends to nearly every entry
// regardless of card network, so it carries no identifying information and
// is dropped before comparing; other generic words (visa, mastercard, ...)
// are kept since they're exactly what disambiguates two cards at the same
// bank.
const STOPWORDS = new Set(["card"]);
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
}

function isSubset(a: string[], b: string[]): boolean {
  return a.length > 0 && a.every((t) => b.includes(t));
}

/** Matches the free-text "Card" string Shortcuts hands over against the
 * caller's accounts by name/nickname/official name: token sets (not raw
 * substrings) compared in either direction, so "TD First Class Travel Card"
 * matches an account literally named "TD First Class Travel Visa". Returns
 * null for no match, and throws an AmbiguousAccountError (with the
 * candidates) if more than one account matches, so the route can surface a
 * message telling the user how to disambiguate (usually: set a distinct
 * nickname on one of the accounts). */
export class AmbiguousAccountError extends Error {
  constructor(public candidates: MatchableAccount[]) {
    super("Ambiguous account match");
  }
}

function accountTokenSets(a: MatchableAccount): string[][] {
  return [accountDisplayName(a.name, a.nickname), a.name, a.nickname, a.officialName]
    .filter((v): v is string => !!v)
    .map(tokens);
}

export function matchAccountByCardName(cardName: string, accounts: MatchableAccount[]): MatchableAccount | null {
  const needle = tokens(cardName);
  if (needle.length === 0) return null;

  const matches = accounts.filter((a) => accountTokenSets(a).some((c) => isSubset(needle, c) || isSubset(c, needle)));

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    // Prefer an exact (token-set-equal) match over a fuzzy subset one --
    // e.g. "TD First Class Travel Card" exactly equal to one account's name
    // shouldn't be blocked by another account whose name merely contains it.
    const exact = matches.filter((a) => accountTokenSets(a).some((c) => c.length === needle.length && isSubset(needle, c)));
    if (exact.length === 1) return exact[0]!;
    throw new AmbiguousAccountError(matches);
  }
  return matches[0]!;
}
