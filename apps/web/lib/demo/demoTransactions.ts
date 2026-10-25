/**
 * Transaction generator for the public read-only demo (lib/demo.ts).
 *
 * Deliberately separate from lib/mock/transactionFixtures.ts: those ~27 rows
 * exist to prove the plumbing works in local dev, and at that volume the
 * demo's best screens look broken — the 13-month cash-flow chart is nearly
 * empty, budgets have no history to average, and recurring detection (which
 * needs 3+ stable occurrences) finds almost nothing. A stranger's first look
 * at Tally needs a full year of a plausible household instead, which is more
 * rows than anyone wants to hand-write, so this composes them from recurring
 * schedules plus seeded-random discretionary spend.
 *
 * Amounts are Plaid convention (positive = money out), so they pass through
 * the same toInternalAmountCents() flip real synced transactions do.
 */

export interface DemoTransaction {
  /** Which mock account this belongs on, by fixture subtype. */
  subtype: "checking" | "savings" | "credit card";
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  merchantName: string | null;
  amount: number; // dollars, Plaid convention (positive = money out)
  pfcPrimary: string;
  pfcDetailed: string;
  pending?: boolean;
}

/** How much history to generate. 13 months fills the Overview cash-flow
 *  chart (12 months + the current partial one) with no empty leading bars. */
export const DEMO_MONTHS = 13;

/**
 * Deterministic PRNG (mulberry32), so re-seeding the demo reproduces exactly
 * the same household rather than a different one each deploy — screenshots,
 * docs, and bug reports all keep matching what a visitor sees.
 */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = makeRng(0x7a11ced);

/** Random float in [min, max). */
function between(min: number, max: number): number {
  return min + rand() * (max - min);
}

/** Dollars, rounded to cents, jittered +/- `spread` fraction around `base`. */
function jitter(base: number, spread = 0.18): number {
  return Math.round(base * between(1 - spread, 1 + spread) * 100) / 100;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today, as UTC midnight — every date below is derived from this. */
function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC date for the given day-of-month, clamped to the month's real length. */
function dayIn(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// ---------------------------------------------------------------------------
// Merchant catalogue
// ---------------------------------------------------------------------------

interface Merchant {
  name: string;
  merchantName: string | null;
  pfcPrimary: string;
  pfcDetailed: string;
  /** Typical ticket, in dollars. */
  typical: number;
}

const GROCERS: Merchant[] = [
  { name: "WHOLEFDS MKT #103", merchantName: "Whole Foods Market", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES", typical: 92 },
  { name: "TRADER JOES #221", merchantName: "Trader Joes", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES", typical: 64 },
  { name: "SAFEWAY #1180", merchantName: "Safeway", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_GROCERIES", typical: 78 },
];

const COFFEE: Merchant[] = [
  { name: "STARBUCKS #4021", merchantName: "Starbucks", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_COFFEE", typical: 6.75 },
  { name: "BLUE BOTTLE COFFEE", merchantName: "Blue Bottle Coffee", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_COFFEE", typical: 5.5 },
];

const RESTAURANTS: Merchant[] = [
  { name: "CHIPOTLE 1842", merchantName: "Chipotle", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_FAST_FOOD", typical: 14.2 },
  { name: "SWEETGREEN", merchantName: "Sweetgreen", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT", typical: 16.4 },
  { name: "TACOS EL BRONCO", merchantName: "Tacos El Bronco", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT", typical: 28.5 },
  { name: "LUCALI PIZZA", merchantName: "Lucali", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT", typical: 52 },
  { name: "DOORDASH*ORDER", merchantName: "DoorDash", pfcPrimary: "FOOD_AND_DRINK", pfcDetailed: "FOOD_AND_DRINK_RESTAURANT", typical: 34 },
];

const TRANSPORT: Merchant[] = [
  { name: "UBER TRIP", merchantName: "Uber", pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES", typical: 23 },
  { name: "MTA*METROCARD", merchantName: "MTA", pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_PUBLIC_TRANSIT", typical: 33 },
  { name: "SHELL OIL", merchantName: "Shell", pfcPrimary: "TRANSPORTATION", pfcDetailed: "TRANSPORTATION_GAS", typical: 48 },
];

const SHOPPING: Merchant[] = [
  { name: "AMAZON.COM*A1B2C3", merchantName: "Amazon", pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", typical: 42 },
  { name: "TARGET T-1904", merchantName: "Target", pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_SUPERSTORES", typical: 58 },
  { name: "UNIQLO 0121", merchantName: "Uniqlo", pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES", typical: 74 },
  { name: "CVS/PHARMACY #8812", merchantName: "CVS", pfcPrimary: "MEDICAL", pfcDetailed: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS", typical: 26 },
];

/** Occasional, deliberately lumpy — gives the cash-flow chart real shape. */
const SPLURGES: Merchant[] = [
  { name: "DELTA AIR", merchantName: "Delta Air Lines", pfcPrimary: "TRAVEL", pfcDetailed: "TRAVEL_FLIGHTS", typical: 412 },
  { name: "AIRBNB * HM4K2Q", merchantName: "Airbnb", pfcPrimary: "TRAVEL", pfcDetailed: "TRAVEL_LODGING", typical: 640 },
  { name: "APPLE STORE R172", merchantName: "Apple", pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_ELECTRONICS", typical: 329 },
  { name: "BROOKLYN BOWL", merchantName: "Brooklyn Bowl", pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS", typical: 118 },
];

/** Fixed monthly charges. `day` is the day of month they post. */
const SUBSCRIPTIONS: (Merchant & { day: number; on: DemoTransaction["subtype"] })[] = [
  { name: "NETFLIX.COM", merchantName: "Netflix", pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_TV_AND_MOVIES", typical: 15.49, day: 3, on: "checking" },
  { name: "SPOTIFY USA", merchantName: "Spotify", pfcPrimary: "ENTERTAINMENT", pfcDetailed: "ENTERTAINMENT_MUSIC_AND_AUDIO", typical: 11.99, day: 14, on: "checking" },
  { name: "APPLE.COM/BILL", merchantName: "Apple", pfcPrimary: "GENERAL_MERCHANDISE", pfcDetailed: "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE", typical: 2.99, day: 8, on: "credit card" },
  { name: "EQUINOX", merchantName: "Equinox", pfcPrimary: "PERSONAL_CARE", pfcDetailed: "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", typical: 210, day: 12, on: "credit card" },
  { name: "VERIZON WIRELESS", merchantName: "Verizon", pfcPrimary: "RENT_AND_UTILITIES", pfcDetailed: "RENT_AND_UTILITIES_TELEPHONE", typical: 82.4, day: 18, on: "checking" },
  { name: "SPECTRUM INTERNET", merchantName: "Spectrum", pfcPrimary: "RENT_AND_UTILITIES", pfcDetailed: "RENT_AND_UTILITIES_INTERNET_AND_CABLE", typical: 69.99, day: 22, on: "checking" },
];

const RENT = 2150;
const PAYCHECK = 4200;

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Builds the whole demo ledger: DEMO_MONTHS months ending today. The last day
 * includes a couple of pending rows, since a real connected account almost
 * always has some and the Transactions screen should show that state.
 */
export function generateDemoTransactions(): DemoTransaction[] {
  const out: DemoTransaction[] = [];
  const now = today();
  const todayIso = iso(now);
  const push = (t: DemoTransaction) => {
    // Never generate into the future — the current month is partial by design.
    if (t.date <= todayIso) out.push(t);
  };

  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (DEMO_MONTHS - 1), 1));

  for (let m = 0; m < DEMO_MONTHS; m++) {
    const cursor = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + m, 1));
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();

    // --- Income: semi-monthly payroll, the 15th and the last day ----------
    for (const day of [15, 31]) {
      push({
        subtype: "checking",
        date: iso(dayIn(year, month, day)),
        name: "PAYROLL DEP ACME CO",
        merchantName: "Acme Co",
        amount: -jitter(PAYCHECK, 0.03),
        pfcPrimary: "INCOME",
        pfcDetailed: "INCOME_WAGES",
      });
    }

    // --- Rent: same amount, first of the month ---------------------------
    push({
      subtype: "checking",
      date: iso(dayIn(year, month, 1)),
      name: "ACME REALTY RENT",
      merchantName: "Acme Realty",
      amount: RENT,
      pfcPrimary: "RENT_AND_UTILITIES",
      pfcDetailed: "RENT_AND_UTILITIES_RENT",
    });

    // --- Electricity: seasonal, so the Budgets screen has a category that
    //     genuinely varies month to month rather than sitting flat --------
    const summerPeak = Math.cos(((month - 6) / 12) * 2 * Math.PI); // +1 in July
    push({
      subtype: "checking",
      date: iso(dayIn(year, month, 11)),
      name: "CON EDISON",
      merchantName: "Con Edison",
      amount: jitter(96 + summerPeak * 46, 0.08),
      pfcPrimary: "RENT_AND_UTILITIES",
      pfcDetailed: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
    });

    // --- Subscriptions ----------------------------------------------------
    for (const sub of SUBSCRIPTIONS) {
      push({
        subtype: sub.on,
        date: iso(dayIn(year, month, sub.day)),
        name: sub.name,
        merchantName: sub.merchantName,
        // Fixed to the cent: recurring detection wants a stable amount band.
        amount: sub.typical,
        pfcPrimary: sub.pfcPrimary,
        pfcDetailed: sub.pfcDetailed,
      });
    }

    // --- Savings: standing transfer out of checking, plus interest --------
    const transferDay = iso(dayIn(year, month, 16));
    const saved = Math.round(between(400, 750));
    push({
      subtype: "checking",
      date: transferDay,
      name: "TRANSFER TO SAVINGS *8890",
      merchantName: null,
      amount: saved,
      pfcPrimary: "TRANSFER_OUT",
      pfcDetailed: "TRANSFER_OUT_SAVINGS",
    });
    push({
      subtype: "savings",
      date: transferDay,
      name: "TRANSFER FROM CHECKING *4021",
      merchantName: null,
      amount: -saved,
      pfcPrimary: "TRANSFER_IN",
      pfcDetailed: "TRANSFER_IN_SAVINGS",
    });
    push({
      subtype: "savings",
      date: iso(dayIn(year, month, 28)),
      name: "INTEREST PAYMENT",
      merchantName: null,
      amount: -jitter(8.1, 0.12),
      pfcPrimary: "INCOME",
      pfcDetailed: "INCOME_INTEREST_EARNED",
    });

    // --- Card payment: a matched pair, so transfer detection has something
    //     real to pair up and exclude from spend on both sides ------------
    const payDay = iso(dayIn(year, month, 6));
    const payment = Math.round(between(700, 1400));
    push({
      subtype: "checking",
      date: payDay,
      name: "RIDGELINE CARD PAYMENT",
      merchantName: "Ridgeline Federal",
      amount: payment,
      pfcPrimary: "LOAN_PAYMENTS",
      pfcDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
    });
    push({
      subtype: "credit card",
      date: payDay,
      name: "PAYMENT THANK YOU",
      merchantName: null,
      amount: -payment,
      pfcPrimary: "LOAN_PAYMENTS",
      pfcDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
    });

    // --- Discretionary spend ---------------------------------------------
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const spend = (merchants: Merchant[], count: number, on: DemoTransaction["subtype"]) => {
      for (let i = 0; i < count; i++) {
        const merchant = pick(merchants);
        push({
          subtype: on,
          date: iso(dayIn(year, month, 1 + Math.floor(rand() * daysInMonth))),
          name: merchant.name,
          merchantName: merchant.merchantName,
          amount: jitter(merchant.typical),
          pfcPrimary: merchant.pfcPrimary,
          pfcDetailed: merchant.pfcDetailed,
        });
      }
    };

    spend(GROCERS, 5, "checking");
    spend(COFFEE, 9, "credit card");
    spend(RESTAURANTS, 8, "credit card");
    spend(TRANSPORT, 6, "checking");
    spend(SHOPPING, 5, "credit card");
    // Roughly every third month carries one big-ticket item.
    if (rand() < 0.38) spend(SPLURGES, 1, "credit card");
  }

  // --- A couple of pending rows at the very end, like a live connection ---
  const pendingCoffee = pick(COFFEE);
  push({
    subtype: "credit card",
    date: todayIso,
    name: pendingCoffee.name,
    merchantName: pendingCoffee.merchantName,
    amount: jitter(pendingCoffee.typical, 0.1),
    pfcPrimary: pendingCoffee.pfcPrimary,
    pfcDetailed: pendingCoffee.pfcDetailed,
    pending: true,
  });
  const pendingGrocer = pick(GROCERS);
  push({
    subtype: "checking",
    date: todayIso,
    name: pendingGrocer.name,
    merchantName: pendingGrocer.merchantName,
    amount: jitter(pendingGrocer.typical),
    pfcPrimary: pendingGrocer.pfcPrimary,
    pfcDetailed: pendingGrocer.pfcDetailed,
    pending: true,
  });

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
