/**
 * Which merchant name a transaction shows. Plaid's merchant_name is usually
 * a tidy version of the bank's description ("STARBUCKS #4021" -> "Starbucks"),
 * but its matcher sometimes lands on an unrelated merchant
 * ("SONNET INSURANCE" -> "Child Net"). When the two share no word at all,
 * the bank's own text is the safer name.
 */

// Words that say nothing about who was paid -- a description made only of
// these (plus short codes and numbers) isn't worth showing over Plaid's name.
const FILLER = new Set([
  "pos", "purchase", "debit", "credit", "card", "visa", "mastercard", "interac", "payment", "pmt", "paymt",
  "transfer", "etransfer", "deposit", "withdrawal", "online", "preauth", "preauthorized", "recurring",
  "bill", "fee", "fees", "service", "charge", "auto", "autopay", "thank", "you", "from", "to", "the",
  "inc", "ltd", "llc", "corp", "www", "com",
]);

// Payment-processor prefixes the bank glues in front of the real name.
const PROCESSOR_PREFIX = new Set(["sq", "tst", "sp", "pp", "dd", "pos", "purchase", "paypal"]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => /[a-z]/.test(w));
}

function isSubsequence(short: string, long: string): boolean {
  let i = 0;
  for (const ch of long) if (ch === short[i]) i++;
  return i === short.length;
}

/** Same word, or one is an abbreviation of the other ("amzn"/"amazon", "wholefds"/"whole"). */
function related(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && short[0] === long[0] && isSubsequence(short, long);
}

/** True when the description and Plaid's merchant name share at least one word. */
export function namesAgree(merchantName: string, description: string): boolean {
  const m = words(merchantName);
  const d = words(description);
  return m.some((mw) => d.some((dw) => related(mw, dw)));
}

/** The bank description tidied for display: no store numbers, processor prefixes or shouting. */
export function cleanDescription(description: string): string {
  const tokens = description
    .replace(/[*#]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/\d/.test(t) && /[a-z]/i.test(t));
  while (tokens.length > 1 && PROCESSOR_PREFIX.has(tokens[0]!.toLowerCase())) tokens.shift();
  return tokens.map((t) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t)).join(" ");
}

/** A description with at least one real word (4+ letters, not banking filler) in it. */
function isInformative(cleaned: string): boolean {
  return words(cleaned).some((w) => w.length >= 4 && !FILLER.has(w));
}

/**
 * Plaid's merchant name, unless it shares nothing with the bank's
 * description and that description names someone -- then the tidied
 * description. Null when Plaid has no merchant (callers fall back to the
 * description already).
 */
export function resolveMerchantName(plaidMerchantName: string | null | undefined, description: string): string | null {
  const merchant = plaidMerchantName?.trim();
  if (!merchant) return null;
  if (namesAgree(merchant, description)) return merchant;
  const cleaned = cleanDescription(description);
  return isInformative(cleaned) ? cleaned : merchant;
}

/** Lookup key for a user's rename of a merchant name. */
export function merchantRenameKey(name: string | null | undefined): string | null {
  const key = name?.trim().replace(/\s+/g, " ").toLowerCase();
  return key ? key : null;
}
