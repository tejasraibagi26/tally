import { describe, it, expect } from "vitest";
import { choosePayday, computeSafeToSpend, countsAsCash, nextDueFromDay, nextScheduledPayday, safeToSpendLine, type CashAccountInput } from "./safeToSpend";
import { formatCents } from "./money";

const today = "2026-10-28";
const now = "2026-10-28T20:00:00Z";
const chq: CashAccountInput = { id: "chq", name: "TD Chequing", type: "depository", subtype: "checking", countsAsCash: null, balance: 318042, syncedAt: "2026-10-28T19:00:00Z" };
const sav: CashAccountInput = { id: "sav", name: "TD Savings", type: "depository", subtype: "savings", countsAsCash: null, balance: 1_000_000, syncedAt: "2026-10-28T19:00:00Z" };
const amex: CashAccountInput = { id: "amex", name: "Amex", type: "credit", subtype: "credit card", countsAsCash: null, balance: 0, syncedAt: null };
const payday = { date: "2026-11-14", source: "paycheque" as const, label: "ACME PAYROLL", amount: 240000 };

function base(overrides: Partial<Parameters<typeof computeSafeToSpend>[0]> = {}) {
  return computeSafeToSpend({ accounts: [chq, sav, amex], bills: [], cards: [], cushion: 10000, payday, today, now, ...overrides });
}

describe("countsAsCash", () => {
  it("counts checking and leaves savings out by default", () => {
    expect(countsAsCash(chq)).toBe(true);
    expect(countsAsCash(sav)).toBe(false);
    expect(countsAsCash({ ...sav, countsAsCash: true })).toBe(true);
    expect(countsAsCash({ ...chq, countsAsCash: false })).toBe(false);
    expect(countsAsCash({ ...amex, countsAsCash: true })).toBe(false);
  });
});

describe("computeSafeToSpend", () => {
  it("takes bills, card payments and the cushion from cash", () => {
    const s = base({
      bills: [
        { id: "rent", label: "Rent", amount: 165000, dueDate: "2026-11-01", accountId: "chq" },
        { id: "rogers", label: "Rogers", amount: 9500, dueDate: "2026-11-03", accountId: null },
      ],
      cards: [{ accountId: "amex", label: "Amex Cobalt", left: 64218, dueDate: "2026-11-06", dueDay: null }],
    });
    expect(s.cashTotal).toBe(318042);
    expect(s.amount).toBe(318042 - 165000 - 9500 - 64218 - 10000);
    expect(s.window).toEqual({ start: today, end: "2026-11-13", days: 17 });
    expect(s.perDay).toBe(Math.floor(s.amount / 17));
    expect(s.notCounted).toEqual([{ id: "sav", name: "TD Savings" }]);
  });

  it("skips bills after payday, on a credit card or from savings", () => {
    const s = base({
      bills: [
        { id: "late", label: "Gym", amount: 5000, dueDate: "2026-11-20", accountId: "chq" },
        { id: "card", label: "Netflix", amount: 1649, dueDate: "2026-11-02", accountId: "amex" },
        { id: "sav", label: "Insurance", amount: 8000, dueDate: "2026-11-02", accountId: "sav" },
      ],
    });
    expect(s.bills).toHaveLength(0);
  });

  it("keeps a bill that slipped a day past due", () => {
    const s = base({ bills: [{ id: "x", label: "Hydro", amount: 7000, dueDate: "2026-10-27", accountId: "chq" }] });
    expect(s.bills[0]).toMatchObject({ id: "x", overdue: true });
  });

  it("assumes a card with no due date is due before payday, and says so", () => {
    const s = base({ cards: [{ accountId: "visa", label: "TD Visa", left: 21000, dueDate: null, dueDay: null }] });
    expect(s.cards).toEqual([{ accountId: "visa", label: "TD Visa", amount: 21000, dueDate: null, assumed: true }]);
  });

  it("uses the due day you entered", () => {
    const inWindow = base({ cards: [{ accountId: "visa", label: "TD Visa", left: 21000, dueDate: null, dueDay: 5 }] });
    expect(inWindow.cards[0]).toMatchObject({ dueDate: "2026-11-05", assumed: false });
    const after = base({ cards: [{ accountId: "visa", label: "TD Visa", left: 21000, dueDate: null, dueDay: 22 }] });
    expect(after.cards).toHaveLength(0);
  });

  it("ignores a paid card", () => {
    expect(base({ cards: [{ accountId: "amex", label: "Amex", left: 0, dueDate: "2026-11-06", dueDay: null }] }).cards).toHaveLength(0);
  });

  it("ends the window today when payday is today", () => {
    const s = base({ payday: { ...payday, date: today } });
    expect(s.paydayToday).toBe(true);
    expect(s.window).toEqual({ start: today, end: today, days: 1 });
  });

  it("has no per-day figure when short", () => {
    const s = base({ bills: [{ id: "rent", label: "Rent", amount: 400000, dueDate: "2026-11-01", accountId: "chq" }] });
    expect(s.amount).toBeLessThan(0);
    expect(s.perDay).toBeNull();
  });

  it("flags a counted account that hasn't synced in a day", () => {
    const s = base({ accounts: [{ ...chq, syncedAt: "2026-10-26T12:00:00Z" }, sav] });
    expect(s.stale).toEqual([{ id: "chq", name: "TD Chequing", syncedAt: "2026-10-26T12:00:00Z" }]);
  });
});

describe("payday", () => {
  it("prefers the paycheque, then the schedule, then month end", () => {
    expect(choosePayday({ nextDate: "2026-11-14", label: "ACME", amount: 1 }, "2026-10-30", today).source).toBe("paycheque");
    expect(choosePayday(null, "2026-10-30", today)).toEqual({ date: "2026-10-30", source: "schedule" });
    expect(choosePayday(null, null, today)).toEqual({ date: "2026-11-01", source: "month_end" });
  });

  it("finds the next scheduled pay date, weekend-shifted", () => {
    expect(nextScheduledPayday([[15, 0]], today)).toBe("2026-10-30");
    expect(nextScheduledPayday([], today)).toBeNull();
  });

  it("rolls a due day into next month once this month's has passed", () => {
    expect(nextDueFromDay(5, today)).toBe("2026-11-05");
    expect(nextDueFromDay(0, today)).toBe("2026-10-31");
  });
});

describe("safeToSpendLine", () => {
  const fmt = (c: number) => formatCents(c);
  it("reads until payday with a per-day amount", () => {
    const line = safeToSpendLine(base(), fmt);
    expect(line.before).toBe("until payday, ");
    expect(line.emphasis).toBe("Sat, Nov 14");
    expect(line.after).toBe(" · about $181.00 a day");
  });

  it("says how short", () => {
    const line = safeToSpendLine(base({ cushion: 400000 }), fmt);
    expect(line.short).toBe(true);
    expect(line.before).toMatch(/short before payday, $/);
  });

  it("names month end when there's no payday", () => {
    const line = safeToSpendLine(base({ payday: { date: "2026-11-01", source: "month_end" } }), fmt);
    expect(line.emphasis).toBe("Sat, Oct 31");
    expect(line.after.startsWith(" (month end)")).toBe(true);
  });
});
