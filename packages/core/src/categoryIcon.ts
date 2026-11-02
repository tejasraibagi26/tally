/**
 * Which icon stands for a transaction's category, shared by web and mobile
 * (each maps the key to its own lucide package). Categories are the user's
 * own names, so the name is matched first, then Plaid's category
 * (pfcDetailed) when the name says nothing, then a plain tag.
 */
export type CategoryIconKey =
  | "shopping-cart" | "coffee" | "utensils" | "fuel" | "train" | "car" | "plane" | "home" | "zap" | "wifi"
  | "smartphone" | "tv" | "music" | "gamepad" | "clapperboard" | "receipt" | "dumbbell" | "pill" | "heart-pulse"
  | "sparkles" | "shirt" | "shopping-bag" | "gift" | "paw-print" | "baby" | "graduation-cap" | "book-open" | "shield"
  | "wrench" | "hammer" | "building" | "landmark" | "piggy-bank" | "banknote" | "arrow-left-right" | "circle-help" | "tag";

// First match wins, so the specific patterns sit above the broad ones.
const BY_NAME: [RegExp, CategoryIconKey][] = [
  [/grocer|supermarket|food basics|produce/i, "shopping-cart"],
  [/coffee|caf[eé]/i, "coffee"],
  [/restaurant|dining|eat(ing)? out|takeout|take-out|food|lunch|dinner|bar\b|pub/i, "utensils"],
  [/gas\b|fuel|petrol/i, "fuel"],
  [/transit|bus\b|train|subway|presto|metro/i, "train"],
  [/taxi|uber|lyft|ride|car\b|auto|parking|vehicle/i, "car"],
  [/flight|travel|trip|vacation|hotel|airbnb/i, "plane"],
  [/rent|mortgage|housing|home\b|house/i, "home"],
  [/hydro|electric|utilit|water|power|energy/i, "zap"],
  [/internet|wifi/i, "wifi"],
  [/phone|mobile|cell/i, "smartphone"],
  [/stream|netflix|tv\b|movie|cinema/i, "tv"],
  [/music|spotify/i, "music"],
  [/game|gaming/i, "gamepad"],
  [/entertain|fun|hobb/i, "clapperboard"],
  [/subscri|membership/i, "receipt"],
  [/gym|fitness|sport|yoga/i, "dumbbell"],
  [/pharm|drug/i, "pill"],
  [/health|medical|doctor|dental|clinic/i, "heart-pulse"],
  [/beauty|personal care|hair|salon|spa/i, "sparkles"],
  [/cloth|apparel|fashion|shoe/i, "shirt"],
  [/shop|amazon|online|store|merch|superstore/i, "shopping-bag"],
  [/gift|donat|charit/i, "gift"],
  [/pet|vet\b/i, "paw-print"],
  [/kid|child|baby|daycare/i, "baby"],
  [/school|tuition|educat|course/i, "graduation-cap"],
  [/book/i, "book-open"],
  [/insur/i, "shield"],
  [/repair|maintenance|service/i, "wrench"],
  [/home improvement|hardware|furnit/i, "hammer"],
  [/tax|government|fee|bank/i, "building"],
  [/loan|debt|interest/i, "landmark"],
  [/saving|invest/i, "piggy-bank"],
  [/pay(check|cheque)|salary|wage|income|refund/i, "banknote"],
  [/transfer/i, "arrow-left-right"],
];

// Plaid's category: the longest prefixes first.
const BY_PFC: [string, CategoryIconKey][] = [
  ["FOOD_AND_DRINK_GROCERIES", "shopping-cart"],
  ["FOOD_AND_DRINK_COFFEE", "coffee"],
  ["FOOD_AND_DRINK", "utensils"],
  ["TRANSPORTATION_GAS", "fuel"],
  ["TRANSPORTATION_PUBLIC_TRANSIT", "train"],
  ["TRANSPORTATION", "car"],
  ["TRAVEL", "plane"],
  ["RENT_AND_UTILITIES_RENT", "home"],
  ["RENT_AND_UTILITIES_INTERNET", "wifi"],
  ["RENT_AND_UTILITIES_TELEPHONE", "smartphone"],
  ["RENT_AND_UTILITIES", "zap"],
  ["ENTERTAINMENT_TV_AND_MOVIES", "tv"],
  ["ENTERTAINMENT_MUSIC", "music"],
  ["ENTERTAINMENT", "clapperboard"],
  ["PERSONAL_CARE_GYMS", "dumbbell"],
  ["PERSONAL_CARE", "sparkles"],
  ["MEDICAL_PHARMACIES", "pill"],
  ["MEDICAL", "heart-pulse"],
  ["GENERAL_MERCHANDISE_CLOTHING", "shirt"],
  ["GENERAL_MERCHANDISE", "shopping-bag"],
  ["HOME_IMPROVEMENT", "hammer"],
  ["GENERAL_SERVICES_INSURANCE", "shield"],
  ["GENERAL_SERVICES", "wrench"],
  ["GOVERNMENT_AND_NON_PROFIT_DONATIONS", "gift"],
  ["GOVERNMENT_AND_NON_PROFIT", "building"],
  ["BANK_FEES", "building"],
  ["LOAN_PAYMENTS", "landmark"],
  ["INCOME", "banknote"],
  ["TRANSFER", "arrow-left-right"],
];

export function categoryIconKey(name: string | null | undefined, pfcDetailed: string | null | undefined): CategoryIconKey {
  if (name) for (const [re, key] of BY_NAME) if (re.test(name)) return key;
  if (pfcDetailed) for (const [prefix, key] of BY_PFC) if (pfcDetailed.startsWith(prefix)) return key;
  return "tag";
}

/** The icon for a row: transfers and uncategorized rows have their own. */
export function transactionIconKey(t: { categoryName: string | null | undefined; pfcDetailed?: string | null; isTransfer?: boolean; uncategorized?: boolean }): CategoryIconKey {
  if (t.isTransfer) return "arrow-left-right";
  if (t.uncategorized) return "circle-help";
  return categoryIconKey(t.categoryName, t.pfcDetailed);
}
