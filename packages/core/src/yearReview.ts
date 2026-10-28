/**
 * Year in review: a calendar year's money, shaped for the review page (web
 * and mobile). Pure: callers load the year's monthly totals, categories,
 * merchants, net worth and subscriptions, and pass "today" (YYYY-MM-DD,
 * user's zone) so a year still in progress reads as "so far".
 */

export interface YearMonthInput {
  month: string; // YYYY-MM-01
  income: number; // cents
  spend: number; // cents, positive
}

export interface YearRankInput {
  key: string;
  label: string;
  colorSlot: number;
  total: number; // cents, positive
  count?: number; // transactions, for merchants
}

export interface YearReviewInput {
  year: number;
  today: string;
  months: YearMonthInput[];
  categories: YearRankInput[];
  merchants: YearRankInput[];
  /** The first net worth snapshot in the year (or the last before it), and now. */
  netWorthStart: { date: string; net: number } | null;
  netWorthNow: number;
  subscriptions: { activeCount: number; monthlyTotal: number };
  transactionCount: number;
}

export interface YearReview {
  year: number;
  /** The year isn't over: every label says "so far". */
  inProgress: boolean;
  /** Months that have started, January first. */
  months: (YearMonthInput & { label: string })[];
  income: number;
  spend: number;
  saved: number;
  /** saved ÷ income; null with no income. */
  savingsRate: number | null;
  /** Among finished months with any spend. Null until one has finished. */
  biggestMonth: (YearMonthInput & { label: string }) | null;
  calmestMonth: (YearMonthInput & { label: string }) | null;
  averageMonthlySpend: number;
  topCategories: (YearRankInput & { share: number })[];
  topMerchants: (YearRankInput & { share: number })[];
  netWorth: { start: number; startDate: string; now: number; change: number; fromJan1: boolean } | null;
  subscriptions: { activeCount: number; yearlyTotal: number };
  transactionCount: number;
}

const TOP = 5;

function monthLabel(month: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

export function buildYearReview(input: YearReviewInput): YearReview {
  const { year, today } = input;
  const inProgress = today < `${year + 1}-01-01`;
  const started = input.months
    .filter((m) => m.month <= today && m.month.startsWith(String(year)))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, label: monthLabel(m.month) }));

  const income = started.reduce((s, m) => s + m.income, 0);
  const spend = started.reduce((s, m) => s + m.spend, 0);
  const saved = income - spend;

  // A month counts toward "biggest" and "calmest" once it's over: the current one is still filling up.
  const currentMonth = `${today.slice(0, 7)}-01`;
  const finished = started.filter((m) => m.month < currentMonth && m.spend > 0);
  const bySpend = [...finished].sort((a, b) => b.spend - a.spend);

  const rank = (rows: YearRankInput[]) => {
    const total = rows.reduce((s, r) => s + r.total, 0) || 1;
    return [...rows]
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP)
      .map((r) => ({ ...r, share: r.total / total }));
  };

  const ns = input.netWorthStart;
  return {
    year,
    inProgress,
    months: started,
    income,
    spend,
    saved,
    savingsRate: income > 0 ? saved / income : null,
    biggestMonth: bySpend[0] ?? null,
    calmestMonth: bySpend.length > 1 ? bySpend.at(-1)! : null,
    averageMonthlySpend: finished.length ? Math.round(finished.reduce((s, m) => s + m.spend, 0) / finished.length) : 0,
    topCategories: rank(input.categories),
    topMerchants: rank(input.merchants),
    netWorth: ns ? { start: ns.net, startDate: ns.date, now: input.netWorthNow, change: input.netWorthNow - ns.net, fromJan1: ns.date <= `${year}-01-07` } : null,
    subscriptions: { activeCount: input.subscriptions.activeCount, yearlyTotal: input.subscriptions.monthlyTotal * 12 },
    transactionCount: input.transactionCount,
  };
}

/** "2026 so far" while the year runs, "2026" after. */
export function yearTitle(r: Pick<YearReview, "year" | "inProgress">): string {
  return r.inProgress ? `${r.year} so far` : String(r.year);
}

/** When the review is worth surfacing on Overview: December, and January for the year just ended. */
export function reviewSeason(today: string): number | null {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (m === 12) return y;
  if (m === 1) return y - 1;
  return null;
}

/** The review the nav and app feature: last year's in January, this year's (so far) the rest of the year. */
export function featuredReviewYear(today: string): { year: number; inProgress: boolean } {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) === 1 ? { year: y - 1, inProgress: false } : { year: y, inProgress: true };
}
