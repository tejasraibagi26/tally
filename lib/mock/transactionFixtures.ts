/**
 * Canned transactions for MOCK_MODE, keyed by the mock account's subtype
 * (lib/mock/fixtures.ts). Amounts are Plaid-convention (positive = money
 * out) so they pass through the same toInternalAmountCents() flip real
 * Plaid transactions do — the seeding path exercises the same sign logic.
 */

export interface MockTransactionSeed {
  daysAgo: number;
  name: string;
  merchantName: string | null;
  amount: number; // dollars, Plaid convention (positive = spend)
  pfcPrimary: string;
  pfcDetailed: string;
  pending?: boolean;
}

const CHECKING_TRANSACTIONS: MockTransactionSeed[] = [
  { daysAgo: 0, name: "STARBUCKS #4021", merchantName: "Starbucks", amount: 6.75, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_COFFEE", pending: true },
  { daysAgo: 1, name: "WHOLEFDS MKT #103", merchantName: "Whole Foods Market", amount: 86.42, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES" },
  { daysAgo: 2, name: "SHELL OIL", merchantName: "Shell", amount: 48.1, pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_GAS" },
  { daysAgo: 3, name: "NETFLIX.COM", merchantName: "Netflix", amount: 15.49, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_TV_AND_MOVIES" },
  { daysAgo: 33, name: "NETFLIX.COM", merchantName: "Netflix", amount: 15.49, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_TV_AND_MOVIES" },
  { daysAgo: 63, name: "NETFLIX.COM", merchantName: "Netflix", amount: 15.49, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_TV_AND_MOVIES" },
  { daysAgo: 5, name: "TRADER JOE'S #221", merchantName: "Trader Joe's", amount: 62.18, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES" },
  { daysAgo: 6, name: "AMAZON.COM*A1B2C3", merchantName: "Amazon", amount: 34.99, pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES" },
  { daysAgo: 8, name: "CHIPOTLE 1842", merchantName: "Chipotle", amount: 13.85, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT" },
  { daysAgo: 9, name: "UBER TRIP", merchantName: "Uber", amount: 22.4, pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES" },
  { daysAgo: 11, name: "CON EDISON", merchantName: "Con Edison", amount: 118.32, pfcPrimary: "RENT_AND_UTILITIES", pfcDetailed: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY" },
  { daysAgo: 14, name: "SPOTIFY USA", merchantName: "Spotify", amount: 11.99, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_MUSIC_AND_AUDIO" },
  { daysAgo: 44, name: "SPOTIFY USA", merchantName: "Spotify", amount: 11.99, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_MUSIC_AND_AUDIO" },
  { daysAgo: 74, name: "SPOTIFY USA", merchantName: "Spotify", amount: 11.99, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_MUSIC_AND_AUDIO" },
  { daysAgo: 16, name: "WHOLEFDS MKT #103", merchantName: "Whole Foods Market", amount: 74.05, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES" },
  { daysAgo: 20, name: "ACME REALTY RENT", merchantName: "Acme Realty", amount: 2150, pfcPrimary: "RENT_AND_UTILITIES", pfcDetailed: "RENT_AND_UTILITIES_RENT" },
  { daysAgo: 25, name: "PAYROLL DEP ACME CO", merchantName: "Acme Co", amount: -4200, pfcPrimary: "INCOME", pfcDetailed: "INCOME_WAGES" },
  { daysAgo: 40, name: "PAYROLL DEP ACME CO", merchantName: "Acme Co", amount: -4200, pfcPrimary: "INCOME", pfcDetailed: "INCOME_WAGES" },
  { daysAgo: 55, name: "PAYROLL DEP ACME CO", merchantName: "Acme Co", amount: -4200, pfcPrimary: "INCOME", pfcDetailed: "INCOME_WAGES" },
];

const CREDIT_TRANSACTIONS: MockTransactionSeed[] = [
  { daysAgo: 0, name: "APPLE.COM/BILL", merchantName: "Apple", amount: 2.99, pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_TV_AND_MOVIES", pending: true },
  { daysAgo: 1, name: "SWEETGREEN", merchantName: "Sweetgreen", amount: 15.2, pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT" },
  { daysAgo: 4, name: "DELTA AIR", merchantName: "Delta Air Lines", amount: 412.6, pfcPrimary: "TRAVEL", pfcDetailed: "TRAVEL_FLIGHTS" },
  { daysAgo: 7, name: "TARGET T-1904", merchantName: "Target", amount: 58.31, pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_SUPERSTORES" },
  { daysAgo: 12, name: "EQUINOX", merchantName: "Equinox", amount: 210, pfcPrimary: "PERSONAL_CARE", pfcDetailed: "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS" },
  { daysAgo: 18, name: "MTA*METROCARD", merchantName: "MTA", amount: 33, pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_PUBLIC_TRANSIT" },
];

const SAVINGS_TRANSACTIONS: MockTransactionSeed[] = [
  { daysAgo: 3, name: "INTEREST PAYMENT", merchantName: null, amount: -8.42, pfcPrimary: "INCOME", pfcDetailed: "INCOME_INTEREST_EARNED" },
  { daysAgo: 33, name: "INTEREST PAYMENT", merchantName: null, amount: -7.91, pfcPrimary: "INCOME", pfcDetailed: "INCOME_INTEREST_EARNED" },
];

export function transactionsForSubtype(subtype: string): MockTransactionSeed[] {
  switch (subtype) {
    case "checking":
      return CHECKING_TRANSACTIONS;
    case "credit card":
      return CREDIT_TRANSACTIONS;
    case "savings":
      return SAVINGS_TRANSACTIONS;
    default:
      return [];
  }
}
