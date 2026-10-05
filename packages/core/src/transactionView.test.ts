import { describe, expect, it } from "vitest";
import { describeTransactionRow, groupByDay, suggestCategories, type TransactionRowInput } from "./transactionView";

const row = (o: Partial<TransactionRowInput>): TransactionRowInput => ({
  amount: -5412,
  isPending: false,
  isTransfer: false,
  excludedFromBudget: false,
  isManual: false,
  source: null,
  name: "LOBLAWS 1234",
  merchantName: "Loblaws",
  categoryId: "groceries",
  categoryKind: "expense",
  categorySource: "plaid",
  splitCount: 0,
  recurringStreamId: null,
  reviewed: true,
  currency: "CAD",
  ...o,
});

describe("describeTransactionRow", () => {
  it("keeps a plain row unmarked", () => {
    expect(describeTransactionRow(row({}), "CAD")).toMatchObject({ mark: null, amountTone: "default", countsInSpend: true, sourceLabel: "by Tally", needsReview: false });
  });

  it("shows exactly one mark, by precedence", () => {
    const r = describeTransactionRow(row({ isPending: true, excludedFromBudget: true, isManual: true }), "CAD");
    expect(r.mark).toEqual({ kind: "pending", text: "pending" });
    expect(r.amountTone).toBe("muted");
  });

  it("marks refunds, transfers, splits, spreads and foreign currency", () => {
    expect(describeTransactionRow(row({ amount: 3999 }), "CAD")).toMatchObject({ mark: { kind: "refund" }, amountTone: "positive" });
    expect(describeTransactionRow(row({ isTransfer: true, categoryId: null }), "CAD")).toMatchObject({ mark: { kind: "transfer" }, countsInSpend: false, uncategorized: false });
    expect(describeTransactionRow(row({ splitCount: 2 }), "CAD").mark).toEqual({ kind: "split", text: "Split · 2" });
    expect(describeTransactionRow(row({ merchantName: "Apple · AirPods (1/6)" }), "CAD").mark).toEqual({ kind: "spread", text: "Spread · 1 of 6" });
    expect(describeTransactionRow(row({ currency: "USD" }), "CAD").mark).toEqual({ kind: "foreign", text: "USD" });
  });

  it("strikes excluded rows and leaves them out of spend", () => {
    expect(describeTransactionRow(row({ excludedFromBudget: true }), "CAD")).toMatchObject({ struck: true, countsInSpend: false, mark: { kind: "excluded" } });
  });

  it("labels who set the category, and flags review and uncategorized", () => {
    expect(describeTransactionRow(row({ categorySource: "rule" }), "CAD").sourceLabel).toBe("by rule");
    expect(describeTransactionRow(row({ categorySource: "manual" }), "CAD").sourceLabel).toBe("by you");
    expect(describeTransactionRow(row({ categoryId: null, reviewed: false }), "CAD")).toMatchObject({ uncategorized: true, needsReview: true, sourceLabel: null });
  });
});

describe("groupByDay", () => {
  it("groups by date with labels and a net that skips transfers", () => {
    const g = groupByDay(
      [
        { postedDate: "2026-10-05", amount: -5412, isTransfer: false, excludedFromBudget: false },
        { postedDate: "2026-10-05", amount: -1330, isTransfer: false, excludedFromBudget: false },
        { postedDate: "2026-10-04", amount: 241200, isTransfer: false, excludedFromBudget: false },
        { postedDate: "2026-10-04", amount: -50000, isTransfer: true, excludedFromBudget: false },
        { postedDate: "2025-12-29", amount: -100, isTransfer: false, excludedFromBudget: false },
      ],
      "2026-10-05",
    );
    expect(g.map((x) => [x.label, x.net])).toEqual([
      ["Today · Mon, Oct 5", -6742],
      ["Yesterday · Sun, Oct 4", 241200],
      ["Mon, Dec 29, 2025", -100],
    ]);
  });
});

describe("suggestCategories", () => {
  it("puts the current guess first, then the merchant's most-used past picks", () => {
    expect(suggestCategories("transport", ["eating", "transport", "eating", "travel"])).toEqual([
      { categoryId: "transport", reason: "current" },
      { categoryId: "eating", reason: "history" },
      { categoryId: "travel", reason: "history" },
    ]);
    expect(suggestCategories(null, [])).toEqual([]);
  });
});
