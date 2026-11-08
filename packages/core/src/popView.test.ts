import { describe, expect, it } from "vitest";
import { greetingFor, isFirstDayOfMonth, leftToSpendLine, finishedDays, onPaceDays, onPaceLine, tallyGroups } from "./popView";
import type { MonthSummary } from "./budgetView";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const summary = (o: Partial<MonthSummary>): MonthSummary => ({ budgeted: 260000, spent: 0, left: 0, perDay: null, daysLeft: null, overCount: 0, ...o });

describe("greetingFor", () => {
  it("splits the day into morning, afternoon and evening", () => {
    expect(greetingFor(5)).toBe("Morning!");
    expect(greetingFor(11)).toBe("Morning!");
    expect(greetingFor(12)).toBe("Afternoon!");
    expect(greetingFor(17)).toBe("Evening!");
    expect(greetingFor(2)).toBe("Evening!");
  });
});

describe("leftToSpendLine", () => {
  it("leads with what's left, then a rounded daily amount", () => {
    expect(leftToSpendLine(summary({ left: 45945, daysLeft: 6, perDay: 7657 }), money)).toBe("$459.45 left for 6 days. About $76.00 a day.");
  });
  it("says over budget with the days still to go", () => {
    expect(leftToSpendLine(summary({ left: -4800, daysLeft: 1 }), money)).toBe("$48.00 over budget, with 1 day to go.");
    expect(leftToSpendLine(summary({ left: -4800, daysLeft: 0 }), money)).toBe("$48.00 over budget this month.");
  });
  it("handles exactly spent and no budget", () => {
    expect(leftToSpendLine(summary({ left: 0, daysLeft: 3 }), money)).toBe("Budget spent in full this month.");
    expect(leftToSpendLine(summary({ budgeted: 0 }), money)).toBeNull();
  });
});

describe("onPaceDays", () => {
  const pace = 8387;
  it("counts every finished day under pace, not just a run", () => {
    const daily = { "2026-10-23": 9000, "2026-10-24": 2000, "2026-10-25": 8387, "2026-10-26": 50000 };
    // 26th is today (not counted); 23rd over pace; the other 24 days of the month count.
    expect(onPaceDays(daily, pace, "2026-10-26", "2026-10-01")).toBe(24);
  });
  it("doesn't reset when yesterday went over", () => {
    expect(onPaceDays({ "2026-10-09": 9000 }, pace, "2026-10-10", "2026-10-01")).toBe(8);
  });
  it("is zero on the first of the month or with no budget", () => {
    expect(onPaceDays({}, pace, "2026-10-01", "2026-10-01")).toBe(0);
    expect(onPaceDays({}, 0, "2026-10-10", "2026-10-01")).toBe(0);
  });
  it("knows how many days have finished", () => {
    expect(finishedDays("2026-10-01")).toBe(0);
    expect(finishedDays("2026-10-26")).toBe(25);
  });
});

describe("tallyGroups", () => {
  it("splits a count into fives and the rest", () => {
    expect(tallyGroups(9)).toEqual({ full: 1, rest: 4 });
    expect(tallyGroups(10)).toEqual({ full: 2, rest: 0 });
    expect(tallyGroups(0)).toEqual({ full: 0, rest: 0 });
  });
});

describe("onPaceLine", () => {
  const fmt = (c: number) => `$${c / 100}`;
  it("greets a new month instead of blaming last month's last day", () => {
    expect(isFirstDayOfMonth("2026-11-01")).toBe(true);
    expect(onPaceLine(0, 12200, "2026-11-01", fmt)).toBe("Stay under $122 today and tomorrow starts your count.");
  });
  it("counts the month's on-pace days out of the finished ones", () => {
    expect(onPaceLine(6, 12200, "2026-11-09", fmt)).toBe("6 of 8 days this month under your $122 daily pace.");
    expect(onPaceLine(8, 12200, "2026-11-09", fmt)).toBe("Every day so far this month under your $122 daily pace.");
    expect(onPaceLine(0, 12200, "2026-11-09", fmt)).toBe("No days under your $122 daily pace yet this month. Today's a fresh start.");
  });
});
