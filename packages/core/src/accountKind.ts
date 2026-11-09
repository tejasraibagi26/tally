/**
 * What kind of account this is. Plaid tags every account with a type
 * (depository | credit | investment | loan) and a subtype ("checking",
 * "savings", "tfsa", ...); that tag is the default. A user can retag a bank
 * account's kind -- the classic case is a second checking account they keep
 * as savings -- and the override wins everywhere the kind means something:
 * the label under the name, and whether the balance counts as spending money
 * by default (safeToSpend.countsAsCashByDefault).
 *
 * Only depository accounts can be retagged, and only within that type:
 * moving a card to "loan" would flip how its balance is signed. The raw
 * Plaid subtype is kept as-is in the database so reconnect matching keeps
 * comparing Plaid's tags with Plaid's tags.
 */

export const KIND_OVERRIDES = {
  depository: ["checking", "savings"],
} as const satisfies Record<string, readonly string[]>;

export type KindOverride = (typeof KIND_OVERRIDES)["depository"][number];

/** The kinds a user may pick for an account of this Plaid type; empty = not retaggable. */
export function kindOptions(type: string): readonly KindOverride[] {
  return type === "depository" ? KIND_OVERRIDES.depository : [];
}

export function isValidKindOverride(type: string, override: string): override is KindOverride {
  return (kindOptions(type) as readonly string[]).includes(override);
}

/**
 * The subtype to reason about: the user's override when it's one this type
 * allows, otherwise Plaid's. An override that doesn't fit (the account's type
 * changed under it) is ignored rather than trusted.
 */
export function effectiveSubtype(type: string, subtype: string | null, override: string | null | undefined): string | null {
  if (override && isValidKindOverride(type, override)) return override;
  return subtype;
}

// Registered-account and plan names Plaid sends in lowercase ("tfsa").
const ACRONYMS = new Set(["tfsa", "rrsp", "fhsa", "resp", "rrif", "lira", "lif", "hsa", "ira", "401k", "403b", "529", "cd", "gic"]);

/** "Credit card", "Savings", "TFSA" -- from a subtype, falling back to the type. */
export function accountKindLabel(type: string, subtype: string | null): string {
  const raw = (subtype ?? type).replace(/_/g, " ").trim();
  if (ACRONYMS.has(raw.toLowerCase())) return raw.toUpperCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
