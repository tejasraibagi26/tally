import { describe, it, expect } from "vitest";
import { normalizeTag, summarizeTag, type TaggedRow } from "./tagView";

let n = 0;
function row(date: string, amount: number, category = "Hotels", overrides: Partial<TaggedRow> = {}): TaggedRow {
  return { id: `t${n++}`, date, amount, isTransfer: false, categoryId: category.toLowerCase(), categoryName: category, colorSlot: 1, categoryKind: "expense", ...overrides };
}

describe("summarizeTag", () => {
  const rows = [
    row("2026-10-03", -120000, "Flights"),
    row("2026-10-04", -60000, "Hotels"),
    row("2026-10-05", -4500, "Dining"),
    row("2026-10-05", -3500, "Dining"),
    row("2026-10-14", 15000, "Hotels"), // refund
    row("2026-10-06", -50000, "Transfer", { isTransfer: true }),
  ];

  it("nets refunds and leaves transfers out", () => {
    const s = summarizeTag("Japan 2026", rows);
    expect(s.spend).toBe(120000 + 60000 + 4500 + 3500 - 15000);
    expect(s.count).toBe(5);
  });

  it("spans first to last day and gives a per-day cost", () => {
    const s = summarizeTag("Japan 2026", rows);
    expect(s).toMatchObject({ firstDate: "2026-10-03", lastDate: "2026-10-14", days: 12 });
    expect(s.perDay).toBe(Math.round(s.spend / 12));
  });

  it("breaks spend down by category, biggest first", () => {
    const s = summarizeTag("Japan 2026", rows);
    expect(s.byCategory.map((c) => c.label)).toEqual(["Flights", "Hotels", "Dining"]);
    expect(s.byCategory[1]!.total).toBe(45000);
  });

  it("sums spend per day", () => {
    expect(summarizeTag("Japan 2026", rows).byDay.find((d) => d.date === "2026-10-05")?.total).toBe(8000);
  });

  it("counts a tagged reimbursement as income, not negative spend", () => {
    const s = summarizeTag("Work trip", [row("2026-10-03", -50000), row("2026-10-20", 50000, "Reimbursement", { categoryKind: "income" })]);
    expect(s).toMatchObject({ spend: 50000, income: 50000 });
  });

  it("has no per-day cost for a single day", () => {
    expect(summarizeTag("Dinner", [row("2026-10-03", -9000)]).perDay).toBeNull();
  });
});

describe("normalizeTag", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normalizeTag("  Japan   2026 ")).toBe("Japan 2026");
    expect(normalizeTag("x".repeat(50))).toHaveLength(40);
  });
});
