import { prettifyPfc, prettifyPfcChild, pfcColorSlot } from "@tally/core/pfc";
import type { categoryKindEnum } from "@/db/schema";

export type CategoryKind = (typeof categoryKindEnum.enumValues)[number];

/**
 * Plaid's Personal Finance Category taxonomy (WORK.md §7.1), hardcoded since
 * it changes rarely and Plaid has no "list categories" endpoint. Verify
 * against Plaid's published taxonomy CSV if detailed values look stale —
 * this seeds system categories, it doesn't validate incoming webhooks.
 */
const TAXONOMY: Record<string, string[]> = {
  INCOME: [
    "INCOME_DIVIDENDS",
    "INCOME_INTEREST_EARNED",
    "INCOME_RETIREMENT_PENSION",
    "INCOME_TAX_REFUND",
    "INCOME_UNEMPLOYMENT",
    "INCOME_WAGES",
    "INCOME_OTHER_INCOME",
  ],
  TRANSFER_IN: [
    "TRANSFER_IN_CASH_ADVANCES_AND_LOANS",
    "TRANSFER_IN_DEPOSIT",
    "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
    "TRANSFER_IN_SAVINGS",
    "TRANSFER_IN_ACCOUNT_TRANSFER",
    "TRANSFER_IN_OTHER_TRANSFER_IN",
  ],
  TRANSFER_OUT: [
    "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
    "TRANSFER_OUT_SAVINGS",
    "TRANSFER_OUT_WITHDRAWAL",
    "TRANSFER_OUT_ACCOUNT_TRANSFER",
    "TRANSFER_OUT_OTHER_TRANSFER_OUT",
  ],
  LOAN_PAYMENTS: [
    "LOAN_PAYMENTS_CAR_PAYMENT",
    "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
    "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT",
    "LOAN_PAYMENTS_MORTGAGE_PAYMENT",
    "LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT",
    "LOAN_PAYMENTS_OTHER_PAYMENT",
  ],
  BANK_FEES: [
    "BANK_FEES_ATM_FEES",
    "BANK_FEES_FOREIGN_TRANSACTION_FEES",
    "BANK_FEES_INSUFFICIENT_FUNDS",
    "BANK_FEES_INTEREST_CHARGE",
    "BANK_FEES_OVERDRAFT_FEES",
    "BANK_FEES_OTHER_BANK_FEES",
  ],
  ENTERTAINMENT: [
    "ENTERTAINMENT_CASINOS_AND_GAMBLING",
    "ENTERTAINMENT_MUSIC_AND_AUDIO",
    "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS",
    "ENTERTAINMENT_TV_AND_MOVIES",
    "ENTERTAINMENT_VIDEO_GAMES",
    "ENTERTAINMENT_OTHER_ENTERTAINMENT",
  ],
  FOOD_AND_DRINK: [
    "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR",
    "FOOD_AND_DRINK_COFFEE",
    "FOOD_AND_DRINK_FAST_FOOD",
    "FOOD_AND_DRINK_GROCERIES",
    "FOOD_AND_DRINK_RESTAURANT",
    "FOOD_AND_DRINK_VENDING_MACHINES",
    "FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK",
  ],
  GENERAL_MERCHANDISE: [
    "GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS",
    "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
    "GENERAL_MERCHANDISE_CONVENIENCE_STORES",
    "GENERAL_MERCHANDISE_DEPARTMENT_STORES",
    "GENERAL_MERCHANDISE_DISCOUNT_STORES",
    "GENERAL_MERCHANDISE_ELECTRONICS",
    "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES",
    "GENERAL_MERCHANDISE_OFFICE_SUPPLIES",
    "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
    "GENERAL_MERCHANDISE_PET_SUPPLIES",
    "GENERAL_MERCHANDISE_SPORTING_GOODS",
    "GENERAL_MERCHANDISE_SUPERSTORES",
    "GENERAL_MERCHANDISE_TOBACCO_AND_VAPE",
    "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
  ],
  HOME_IMPROVEMENT: [
    "HOME_IMPROVEMENT_FURNITURE",
    "HOME_IMPROVEMENT_HARDWARE",
    "HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE",
    "HOME_IMPROVEMENT_SECURITY",
    "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT",
  ],
  MEDICAL: [
    "MEDICAL_DENTAL_CARE",
    "MEDICAL_EYE_CARE",
    "MEDICAL_NURSING_CARE",
    "MEDICAL_PHARMACIES_AND_SUPPLEMENTS",
    "MEDICAL_PRIMARY_CARE",
    "MEDICAL_VETERINARY_SERVICES",
    "MEDICAL_OTHER_MEDICAL",
  ],
  PERSONAL_CARE: [
    "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS",
    "PERSONAL_CARE_HAIR_AND_BEAUTY",
    "PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING",
    "PERSONAL_CARE_OTHER_PERSONAL_CARE",
  ],
  // Not part of Plaid's real PFC taxonomy — Plaid has no dedicated bucket for
  // app/software subscriptions (Claude Pro, Lightroom, a wallpaper app, …),
  // which otherwise land wherever the merchant happens to fall (general
  // services, general merchandise, entertainment). Seeded so it exists as a
  // pickable/rule-target category; nothing auto-categorizes into it, since no
  // real transaction's pfc_detailed will ever match these synthetic values —
  // assign it manually or with a merchant-name rule instead.
  SUBSCRIPTIONS: ["SUBSCRIPTIONS_SOFTWARE_AND_APPS", "SUBSCRIPTIONS_OTHER_SUBSCRIPTIONS"],
  GENERAL_SERVICES: [
    "GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING",
    "GENERAL_SERVICES_AUTOMOTIVE",
    "GENERAL_SERVICES_CHILDCARE",
    "GENERAL_SERVICES_CONSULTING_AND_LEGAL",
    "GENERAL_SERVICES_EDUCATION",
    "GENERAL_SERVICES_INSURANCE",
    "GENERAL_SERVICES_POSTAGE_AND_SHIPPING",
    "GENERAL_SERVICES_STORAGE",
    "GENERAL_SERVICES_OTHER_GENERAL_SERVICES",
  ],
  GOVERNMENT_AND_NON_PROFIT: [
    "GOVERNMENT_AND_NON_PROFIT_DONATIONS",
    "GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES",
    "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
    "GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT",
  ],
  TRANSPORTATION: [
    "TRANSPORTATION_BIKES_AND_SCOOTERS",
    "TRANSPORTATION_GAS",
    "TRANSPORTATION_PARKING",
    "TRANSPORTATION_PUBLIC_TRANSIT",
    "TRANSPORTATION_TAXIS_AND_RIDE_SHARES",
    "TRANSPORTATION_TOLLS",
    "TRANSPORTATION_OTHER_TRANSPORTATION",
  ],
  TRAVEL: ["TRAVEL_FLIGHTS", "TRAVEL_LODGING", "TRAVEL_RENTAL_CARS", "TRAVEL_OTHER_TRAVEL"],
  RENT_AND_UTILITIES: [
    "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
    "RENT_AND_UTILITIES_INTERNET_AND_CABLE",
    "RENT_AND_UTILITIES_RENT",
    "RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT",
    "RENT_AND_UTILITIES_TELEPHONE",
    "RENT_AND_UTILITIES_WATER",
    "RENT_AND_UTILITIES_OTHER_UTILITIES",
  ],
};

/** §6.5: a credit card payment is a transfer, not spend — the one detailed value whose kind departs from its primary's default. */
const KIND_OVERRIDES: Record<string, CategoryKind> = {
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "transfer",
};

function kindForPrimary(primary: string): CategoryKind {
  if (primary === "INCOME") return "income";
  if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT") return "transfer";
  return "expense";
}

export function slugifyPfc(pfcValue: string): string {
  return pfcValue.toLowerCase().replace(/_/g, "-");
}

export interface TaxonomyParent {
  slug: string;
  name: string;
  kind: CategoryKind;
  colorSlot: number;
  children: TaxonomyChild[];
}

export interface TaxonomyChild {
  slug: string;
  name: string;
  kind: CategoryKind;
  pfcDetailed: string;
}

/** The full seed list: one parent per PFC primary, one child per PFC detailed value. */
export function buildCategoryTaxonomy(): TaxonomyParent[] {
  return Object.entries(TAXONOMY).map(([primary, detailedValues]) => ({
    slug: slugifyPfc(primary),
    name: prettifyPfc(primary),
    kind: kindForPrimary(primary),
    colorSlot: pfcColorSlot(primary),
    children: detailedValues.map((detailed) => ({
      slug: slugifyPfc(detailed),
      name: prettifyPfcChild(primary, detailed),
      kind: KIND_OVERRIDES[detailed] ?? kindForPrimary(primary),
      pfcDetailed: detailed,
    })),
  }));
}

/** Looks up the detailed-value slug for a transaction's `pfc_detailed` — used to resolve its default category. */
export function categorySlugForPfc(pfcDetailed: string | null): string | null {
  return pfcDetailed ? slugifyPfc(pfcDetailed) : null;
}
