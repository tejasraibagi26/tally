import { describe, it, expect } from "vitest";
import {
  NO_SPEND,
  computeForecast,
  occurrencesFor,
  streamQualifies,
  type DailySpendProfile,
  type ForecastCardInput,
  type ForecastInput,
  type ForecastStreamInput,
} from "./forecast";
import { choosePayday, computeSafeToSpend, nextScheduledPayday, type CashAccountInput } from "./safeToSpend";

const today = "2026-11-01";
const now = "2026-11-01T14:00:00Z";

const chq: CashAccountInput = { id: "chq", name: "TD Chequing", type: "depository", subtype: "checking", countsAsCash: null, balance: 324018, syncedAt: "2026-11-01T12:00:00Z" };
const sav: CashAccountInput = { id: "sav", name: "TD Savings", type: "depository", subtype: "savings", countsAsCash: null, balance: 2_000_000, syncedAt: "2026-11-01T12:00:00Z" };
const amexAcct: CashAccountInput = { id: "amex", name: "Amex Cobalt", type: "credit", subtype: "credit card", countsAsCash: null, balance: 0, syncedAt: "2026-11-01T12:00:00Z" };

function stream(over: Partial<ForecastStreamInput> = {}): ForecastStreamInput {
  return {
    id: "s1", label: "Rent", averageAmount: -145000, frequency: "monthly",
    predictedNextDate: "2026-11-03", manualNextDueDate: null, lastDate: "2026-10-03",
    status: "active", isManual: false, accountId: "chq",
    amortizeMonthly: false, amortizeMonths: 12, ...over,
  };
}

const amexCard: ForecastCardInput = { accountId: "amex", label: "Amex Cobalt ····1004", left: 121044, dueDate: "2026-11-12", dueDay: null };

function base(over: Partial<ForecastInput> = {}): ForecastInput {
  return {
    accounts: [chq, sav, amexAcct],
    streams: [stream(), stream({ id: "s2", label: "Netflix", averageAmount: -1899, predictedNextDate: "2026-11-12", lastDate: "2026-10-12" })],
    cards: [amexCard],
    incomes: [{ id: "inc", label: "Paycheque", amount: 245000, dayAnchors: [15, 0] }],
    paycheque: null,
    spend: NO_SPEND,
    cushion: 40000,
    today,
    days: 60,
    ...over,
  };
}

const dayAt = (f: ReturnType<typeof computeForecast>, date: string) => f.days.find((d) => d.date === date)!;

/** The same ledger the Forecast spec draws. If these numbers move, the model moved. */
const SPEND: DailySpendProfile = { byWeekday: [6100, 4400, 4100, 5200, 5800, 8600, 9400], sd: 3400, source: "weekday_median" };
const HOUSEHOLD_BILLS: [string, string, number, string][] = [
  ["rent", "Rent · E-transfer", 145000, "2026-11-03"],
  ["hydro", "Hydro One", 11840, "2026-11-09"],
  ["netflix", "Netflix", 1899, "2026-11-12"],
  ["spotify", "Spotify", 1399, "2026-11-18"],
  ["rogers", "Rogers", 8500, "2026-11-20"],
  ["intact", "Intact Insurance", 14200, "2026-11-22"],
  ["movati", "Movati", 5400, "2026-11-25"],
];
const household = (over: Partial<ForecastInput> = {}): ForecastInput =>
  base({
    streams: HOUSEHOLD_BILLS.map(([id, label, amount, date]) =>
      stream({ id, label, averageAmount: -amount, predictedNextDate: date, lastDate: null }),
    ),
    spend: SPEND,
    ...over,
  });

describe("the Safe to spend invariant", () => {
  it("matches computeSafeToSpend the day before payday, with spending switched off", () => {
    const f = computeForecast(base());
    const payday = choosePayday(null, nextScheduledPayday([[15, 0]], today), today);

    // Nov 15 2026 is a Sunday, so resolvePayDate pulls payday back to the Friday.
    expect(payday.date).toBe("2026-11-13");
    expect(f.firstPayday).toBe("2026-11-13");

    const safe = computeSafeToSpend({
      accounts: [chq, sav, amexAcct],
      bills: [
        { id: "s1", label: "Rent", amount: 145000, dueDate: "2026-11-03", accountId: "chq" },
        { id: "s2", label: "Netflix", amount: 1899, dueDate: "2026-11-12", accountId: "chq" },
      ],
      cards: [{ accountId: "amex", label: "Amex Cobalt ····1004", left: 121044, dueDate: "2026-11-12", dueDay: null }],
      cushion: 40000,
      payday,
      today,
      now,
    });

    expect(dayAt(f, "2026-11-12").balance - f.cushion).toBe(safe.amount);
    expect(safe.amount).toBe(16075);
  });

  it("counts only cash accounts into the opening balance", () => {
    expect(computeForecast(base()).openingCash).toBe(324018);
  });
});

describe("bills", () => {
  it("repeats a monthly stream across the window", () => {
    const dates = occurrencesFor(stream(), "2026-11-01", "2026-12-31");
    expect(dates).toEqual(["2026-11-03", "2026-12-03"]);
  });

  it("clamps a month-end stream into a shorter month", () => {
    const dates = occurrencesFor(stream({ predictedNextDate: "2026-01-31" }), "2026-01-01", "2026-03-31");
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-28"]);
  });

  it("rolls a stale predicted date forward instead of dropping the bill", () => {
    const dates = occurrencesFor(stream({ predictedNextDate: "2026-08-03" }), "2026-11-01", "2026-11-30");
    expect(dates).toEqual(["2026-11-03"]);
  });

  it("keeps a bill that slipped a day past due, on day 0", () => {
    const f = computeForecast(base({ streams: [stream({ predictedNextDate: "2026-10-31" })], cards: [] }));
    expect(dayAt(f, today).balance).toBe(324018 - 145000);
  });

  it("takes an amortised stream as one lumpy charge, never a twelfth (Trap 1)", () => {
    const dropbox = stream({
      id: "drop", label: "Dropbox", averageAmount: -14388, frequency: "annual",
      amortizeMonthly: true, amortizeMonths: 12, lastDate: "2025-12-04", predictedNextDate: "2026-12-04",
    });
    expect(occurrencesFor(dropbox, "2026-11-01", "2026-12-31")).toEqual(["2026-12-04"]);

    const f = computeForecast(base({ streams: [dropbox], cards: [], incomes: [] }));
    const charges = f.events.filter((e) => e.sourceId === "drop");
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ date: "2026-12-04", amount: -14388 });
  });

  it("keeps a bill charged to a card off cash, and puts it on that card instead (Trap 2)", () => {
    const onCard = stream({ id: "s2", label: "Netflix", averageAmount: -1899, accountId: "amex", predictedNextDate: "2026-11-18", lastDate: "2026-10-18" });
    const f = computeForecast(base({ streams: [onCard], incomes: [] }));

    const netflix = f.events.filter((e) => e.sourceId === "s2");
    expect(netflix.every((e) => e.affectsCash === false)).toBe(true);

    // Nov 18 falls in the cycle closing Dec 12, so it comes out of cash there.
    const projected = f.events.find((e) => e.kind === "card" && e.modelled);
    expect(projected).toMatchObject({ date: "2026-12-12", amount: -1899, affectsCash: true });

    // ...and never twice: the Nov 18 charge itself leaves the balance alone.
    expect(dayAt(f, "2026-11-18").balance).toBe(dayAt(f, "2026-11-17").balance);
  });

  it("vouches for a manual stream whatever its status (Trap 3)", () => {
    expect(streamQualifies(stream({ isManual: true, status: "cancelled" }))).toBe(true);
    expect(streamQualifies(stream({ manualNextDueDate: "2026-11-09", status: "cancelled" }))).toBe(true);
  });

  it("counts every subscription Subscriptions lists, late ones included", () => {
    expect(streamQualifies(stream({ status: "at_risk" }))).toBe(true);
    expect(streamQualifies(stream({ status: "cancelled" }))).toBe(false);
    expect(streamQualifies(stream({ averageAmount: 245000 }))).toBe(false);
  });
});

describe("cards", () => {
  it("takes the issued statement as known and the next cycle as projected", () => {
    const onCard = stream({ id: "s2", label: "Netflix", averageAmount: -1899, accountId: "amex", predictedNextDate: "2026-11-18", lastDate: "2026-10-18" });
    const f = computeForecast(base({ streams: [onCard], incomes: [] }));
    const cards = f.events.filter((e) => e.kind === "card");
    expect(cards).toEqual([
      expect.objectContaining({ date: "2026-11-12", amount: -121044, modelled: false }),
      expect.objectContaining({ date: "2026-12-12", amount: -1899, modelled: true }),
    ]);
  });

  it("leaves out a statement whose due date is already well past", () => {
    // Two months overdue: either paid and not yet synced, or stale data.
    // computeSafeToSpend drops it, so the curve must not invent the debt.
    const f = computeForecast(base({ cards: [{ ...amexCard, dueDate: "2026-08-31" }], incomes: [] }));
    expect(f.events.filter((e) => e.kind === "card")).toHaveLength(0);
  });

  it("keeps a statement that slipped a day or two past due", () => {
    const f = computeForecast(base({ cards: [{ ...amexCard, dueDate: "2026-10-30" }], incomes: [] }));
    expect(f.events.find((e) => e.kind === "card")).toMatchObject({ date: "2026-10-30", amount: -121044 });
  });

  it("leaves out a card with no statement and no due day", () => {
    const f = computeForecast(base({ cards: [{ accountId: "visa", label: "TD Visa", left: null, dueDate: null, dueDay: null }] }));
    expect(f.events.filter((e) => e.kind === "card")).toHaveLength(0);
  });

  it("resolves a due day when the bank reports no due date", () => {
    const f = computeForecast(base({ cards: [{ accountId: "visa", label: "TD Visa", left: 21000, dueDate: null, dueDay: 20 }], incomes: [] }));
    expect(f.events.find((e) => e.kind === "card")).toMatchObject({ date: "2026-11-20", amount: -21000 });
  });
});

describe("income", () => {
  it("repeats a semi-monthly schedule and moves weekend paydays back to Friday", () => {
    const f = computeForecast(base({ streams: [], cards: [] }));
    expect(f.events.filter((e) => e.kind === "income").map((e) => e.date)).toEqual([
      "2026-11-13", // Sun Nov 15 → Fri
      "2026-11-30",
      "2026-12-15",
      "2026-12-31",
    ]);
  });

  it("steps a detected paycheque by its cadence when there is no schedule", () => {
    const f = computeForecast(base({
      streams: [], cards: [], incomes: [],
      paycheque: { label: "ACME PAYROLL", amount: 245000, cadence: "biweekly", nextDate: "2026-11-06", lastDate: "2026-10-23" },
    }));
    expect(f.events.map((e) => e.date)).toEqual(["2026-11-06", "2026-11-20", "2026-12-04", "2026-12-18"]);
  });

  it("reads a semi-monthly paycheque's anchors off its own two dates", () => {
    // Assuming a 15th-and-last pattern produced a spurious payday the day
    // after a real one, and a last-of-month date never advanced at all --
    // the window filled with hundreds of copies of one payday (found
    // against live demo data).
    const f = computeForecast(base({
      streams: [], cards: [], incomes: [],
      paycheque: { label: "Acme Co", amount: 419637, cadence: "semimonthly", nextDate: "2026-11-30", lastDate: "2026-11-13" },
    }));
    const dates = f.events.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length);
    // Anchors read off the pair: the 13th is a shifted 15th, the 30th is
    // its month's last, so anchor 0 keeps Dec 31 exact.
    expect(dates).toEqual(["2026-11-13", "2026-11-30", "2026-12-15", "2026-12-31"]);
  });

  it("never projects income when there is neither a schedule nor a paycheque", () => {
    const f = computeForecast(base({ incomes: [], paycheque: null }));
    expect(f.events.some((e) => e.kind === "income")).toBe(false);
    expect(f.headline).toBeNull();
  });
});

describe("the headline", () => {
  it("names the first day under the buffer, not the deepest", () => {
    // A property-tax instalment in December digs deeper than the November dip.
    const f = computeForecast(household({
      streams: [
        ...household().streams,
        stream({ id: "tax", label: "Property tax", averageAmount: -200000, frequency: "quarterly", predictedNextDate: "2026-12-11", lastDate: null }),
      ],
    }));
    expect(f.headline).toMatchObject({ kind: "shortfall", date: "2026-11-12", amount: -18865 });
    expect(f.lowest.date.slice(0, 7)).toBe("2026-12");
    expect(f.lowest.amount).toBeLessThan(f.headline!.amount);
  });

  it("names the two biggest things that went out before the dip", () => {
    expect(computeForecast(household()).headline!.causes).toEqual([
      { label: "Amex Cobalt ····1004 statement", amount: 121044 },
      { label: "Hydro One", amount: 11840 },
    ]);
  });

  it("reports a floor when nothing crosses the buffer", () => {
    const f = computeForecast(base({ cards: [], cushion: 0 }));
    expect(f.headline!.kind).toBe("floor");
    expect(f.headline!.amount).toBeGreaterThanOrEqual(0);
  });

  it("treats a band-only dip as a note, never the headline", () => {
    // A buffer the central line clears but the lower edge of the band does not.
    const f = computeForecast(base({ cards: [], spend: SPEND, cushion: 110000 }));
    expect(f.lowest.amount).toBeGreaterThanOrEqual(110000);
    expect(f.headline!.kind).toBe("floor");
    expect(f.bandBreach).not.toBeNull();
    expect(f.bandBreach!.amount).toBeLessThan(110000);
  });

  it("draws no band at all without a spend profile", () => {
    const f = computeForecast(base());
    expect(f.days.every((d) => d.lo === d.balance && d.hi === d.balance)).toBe(true);
    expect(f.bandBreach).toBeNull();
  });
});

describe("the worked household from the spec", () => {
  it("bottoms out at −$188.65 on Nov 12 and recovers by year end", () => {
    const f = computeForecast(household());
    expect(f.openingCash).toBe(324018);
    expect(dayAt(f, "2026-11-12").balance).toBe(-18865);
    expect(dayAt(f, "2026-11-13").balance).toBe(217535);
    expect(dayAt(f, "2026-11-30").balance).toBe(325936);
    // Nov 12 is also the floor: nothing is charged to the Amex, so its second
    // cycle projects no payment and December never digs as deep.
    expect(f.lowest).toEqual({ date: "2026-11-12", amount: -18865 });
  });

  it("totals four paycheques in and everything else out", () => {
    const f = computeForecast(household());
    expect(f.moneyIn).toBe(980000);
    expect(f.events.filter((e) => e.kind === "income")).toHaveLength(4);
  });
});
