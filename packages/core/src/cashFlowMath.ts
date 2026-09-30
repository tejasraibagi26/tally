export interface CashFlowMonthLike {
  month: string; // YYYY-MM-01
  income: number; // cents
  spend: number; // cents, positive
}

/**
 * Drops the months before the first one with any income or spend, so a
 * user with 3 months of history sees 3 months, not 9 empty slots and 3
 * squeezed bars. Empty months after the first real one stay -- a gap in the
 * middle is real information.
 */
export function trimLeadingEmptyMonths<T extends CashFlowMonthLike>(months: T[]): T[] {
  const first = months.findIndex((m) => m.income !== 0 || m.spend !== 0);
  return first === -1 ? [] : months.slice(first);
}

/**
 * The headline over the cash flow chart: average saved per month and the
 * savings rate. Uses completed months only (every month but the last, which
 * is the one in progress) whenever there are any -- a half-finished month,
 * often before payday, drags both numbers down. Falls back to all months
 * when the in-progress month is the only one.
 */
export function cashFlowSummary(months: CashFlowMonthLike[]): { avgSaved: number; savingsRate: number | null; monthsCounted: number } {
  const basis = months.length > 1 ? months.slice(0, -1) : months;
  if (basis.length === 0) return { avgSaved: 0, savingsRate: null, monthsCounted: 0 };
  const income = basis.reduce((s, m) => s + m.income, 0);
  const saved = basis.reduce((s, m) => s + (m.income - m.spend), 0);
  return { avgSaved: Math.round(saved / basis.length), savingsRate: income > 0 ? saved / income : null, monthsCounted: basis.length };
}

export interface GapPoint {
  x: number; // month index; fractional for an inserted crossing point
  income: number;
  spend: number;
  crossing: boolean;
}

/**
 * Income/spend points with the exact point inserted wherever the two lines
 * cross, so a chart shading the gap green (saved) or red (overspent) can
 * switch colors precisely where the lines meet rather than one month late.
 */
export function withCrossings(months: CashFlowMonthLike[]): GapPoint[] {
  const out: GapPoint[] = [];
  months.forEach((m, i) => {
    if (i > 0) {
      const prev = months[i - 1]!;
      const d0 = prev.income - prev.spend;
      const d1 = m.income - m.spend;
      if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) {
        const t = d0 / (d0 - d1);
        const v = prev.income + t * (m.income - prev.income);
        out.push({ x: i - 1 + t, income: v, spend: v, crossing: true });
      }
    }
    out.push({ x: i, income: m.income, spend: m.spend, crossing: false });
  });
  return out;
}
