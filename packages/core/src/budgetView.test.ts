import { describe, expect, it } from "vitest";
import { budgetRowState, groupBudgets, monthSummary, type MonthContext } from "./budgetView";

const money = (c: number) => `$${Math.round(c / 100)}`;
const day5: MonthContext = { phase: "current", daysElapsed: 5, daysInMonth: 31 };
const line = (amount: number, spend: number, o: Partial<{ rolloverFromPrior: number; isFixedAmount: boolean }> = {}) => ({
  amount,
  spend,
  rolloverFromPrior: o.rolloverFromPrior ?? 0,
  isFixedAmount: o.isFixedAmount ?? false,
});

describe("budgetRowState", () => {
  it("is on pace with no note and the category color", () => {
    const s = budgetRowState(line(60_000, 5_000), day5, money);
    expect(s).toMatchObject({ barTone: "category", label: "$550 left", labelTone: "default", note: null, aheadOfPace: false });
    expect(s.pacePct).toBeCloseTo(5 / 31);
  });

  it("flags ahead of pace before the 80% line", () => {
    expect(budgetRowState(line(60_000, 14_200), day5, money)).toMatchObject({ aheadOfPace: true, note: "On pace for $880", noteTone: "warning" });
  });

  it("goes amber from 80% to under 100%, then back to the category color when exactly met", () => {
    expect(budgetRowState(line(25_000, 21_200), day5, money)).toMatchObject({ barTone: "warning", label: "$38 left", labelTone: "warning", note: "On pace for $1314" });
    expect(budgetRowState(line(18_000, 18_000), day5, money)).toMatchObject({ barTone: "category", label: "Spent in full", fillPct: 1, overPct: 0 });
  });

  it("splits an overage into category fill plus red", () => {
    const s = budgetRowState(line(20_000, 24_600), day5, money);
    expect(s).toMatchObject({ label: "$46 over", labelTone: "negative", pacePct: null, projected: null });
    expect(s.fillPct + s.overPct).toBeCloseTo(1);
    expect(s.fillPct).toBeCloseTo(200 / 246);
  });

  it("treats fixed budgets as paid / not paid with no pace or projection", () => {
    expect(budgetRowState(line(210_000, 210_000, { isFixedAmount: true }), day5, money)).toMatchObject({ label: "Paid · $2100", pacePct: null, projected: null });
    expect(budgetRowState(line(210_000, 0, { isFixedAmount: true }), day5, money).label).toBe("Not paid yet");
  });

  it("counts rollover as available", () => {
    expect(budgetRowState(line(9_000, 4_100, { rolloverFromPrior: 1_200 }), day5, money)).toMatchObject({ available: 10_200, label: "$61 left" });
  });

  it("reads past months as under/over and future months as the budget", () => {
    expect(budgetRowState(line(60_000, 53_400), { phase: "past" }, money)).toMatchObject({ label: "$66 under", labelTone: "positive", pacePct: null });
    expect(budgetRowState(line(60_000, 0), { phase: "future" }, money)).toMatchObject({ label: "$600 budget", labelTone: "muted" });
  });
});

describe("monthSummary", () => {
  it("totals and gives a per-day allowance including today", () => {
    const s = monthSummary([line(60_000, 14_200), line(25_000, 21_200), line(20_000, 24_600)], day5);
    expect(s).toMatchObject({ budgeted: 105_000, spent: 60_000, left: 45_000, daysLeft: 27, overCount: 1 });
    expect(s.perDay).toBe(Math.floor(45_000 / 27));
  });
});

describe("groupBudgets", () => {
  it("groups by parent, biggest budgets first", () => {
    const g = groupBudgets([
      { ...line(60_000, 0), categoryName: "Groceries", parentName: "Food" },
      { ...line(210_000, 0), categoryName: "Rent", parentName: null },
      { ...line(25_000, 0), categoryName: "Eating out", parentName: "Food" },
    ]);
    expect(g.map((x) => x.name)).toEqual(["Rent", "Food"]);
    expect(g[1]!.lines.map((l) => l.categoryName)).toEqual(["Groceries", "Eating out"]);
    expect(g[1]!.budgeted).toBe(85_000);
  });
});
