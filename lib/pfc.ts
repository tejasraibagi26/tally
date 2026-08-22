/**
 * Cosmetic-only helpers for Plaid's Personal Finance Category strings until
 * the real category system (system categories + rules, WORK.md §7.1) lands
 * in Milestone 4. Never persisted — display formatting only.
 */

const OVERRIDES: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Restaurants",
  FOOD_AND_DRINK_COFFEE: "Coffee shops",
  TRANSPORTATION_GAS: "Gas",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Taxis & ride share",
  TRANSPORTATION_PUBLIC_TRANSIT: "Public transit",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "Online shopping",
  GENERAL_MERCHANDISE_SUPERSTORES: "Superstores",
  RENT_AND_UTILITIES_RENT: "Rent",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities",
  ENTERTAINMENT_TV_AND_MOVIES: "Streaming",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Music",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Gym & fitness",
  TRAVEL_FLIGHTS: "Flights",
  INCOME_WAGES: "Paycheck",
  INCOME_INTEREST_EARNED: "Interest",
};

export function prettifyPfc(detailed: string | null): string {
  if (!detailed) return "Uncategorized";
  if (OVERRIDES[detailed]) return OVERRIDES[detailed];
  // Fallback for any real Plaid value outside the table above: title-case
  // the whole detailed string rather than guessing where the prefix ends.
  return detailed
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const PRIMARY_TO_SLOT: Record<string, number> = {
  FOOD_AND_DRINK: 1,
  TRANSPORTATION: 2,
  GENERAL_MERCHANDISE: 3,
  RENT_AND_UTILITIES: 4,
  ENTERTAINMENT: 5,
  PERSONAL_CARE: 6,
  TRAVEL: 7,
  INCOME: 8,
};

/** Maps a PFC primary bucket to a fixed --series-N slot for the category dot. Falls back to a stable hash for buckets not in the table above. */
export function pfcColorSlot(primary: string | null): number {
  if (!primary) return 3;
  if (PRIMARY_TO_SLOT[primary]) return PRIMARY_TO_SLOT[primary];
  let hash = 0;
  for (let i = 0; i < primary.length; i++) hash = (hash * 31 + primary.charCodeAt(i)) >>> 0;
  return (hash % 8) + 1;
}
