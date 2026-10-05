/** Pure FIRE (Financial Independence, Retire Early) math. All money values are integer cents; rates are decimals (0.04, not 4). */

export function fireNumber(annualExpenses: number, swr: number): number {
  return annualExpenses / swr;
}

/** Unclamped — can exceed 1 once past FI. Callers clamp for a progress-bar width but should show the real number in text. */
export function fireProgressPct(currentValue: number, fireNumberValue: number): number {
  return fireNumberValue > 0 ? currentValue / fireNumberValue : 0;
}

/** Future value of a lump sum plus a level monthly contribution, compounded monthly at `monthlyRate` for `months`. */
function futureValue(pv: number, monthlyContribution: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return pv + monthlyContribution * months;
  const factor = Math.pow(1 + monthlyRate, months);
  return pv * factor + (monthlyContribution * (factor - 1)) / monthlyRate;
}

export interface YearsToFireParams {
  currentValue: number;
  monthlyContribution: number;
  annualReturnRate: number;
  targetValue: number;
}

export interface YearsToFireResult {
  years: number | null; // null when unreachable with the given inputs
  alreadyThere: boolean;
}

/**
 * Solved in closed form from the future-value-of-a-growing-annuity identity
 * (target = PV(1+r)^n + PMT·[(1+r)^n − 1]/r, r monthly) rather than iterated —
 * contribution and rate are both constant, so the closed form is exact and
 * avoids float drift from a month-by-month loop.
 */
export function yearsToFire({ currentValue, monthlyContribution, annualReturnRate, targetValue }: YearsToFireParams): YearsToFireResult {
  if (currentValue >= targetValue) return { years: 0, alreadyThere: true };

  const r = annualReturnRate / 12;

  if (r === 0) {
    if (monthlyContribution <= 0) return { years: null, alreadyThere: false };
    const months = (targetValue - currentValue) / monthlyContribution;
    return { years: months / 12, alreadyThere: false };
  }

  const denominator = currentValue + monthlyContribution / r;
  if (denominator === 0) return { years: null, alreadyThere: false };

  const x = (targetValue + monthlyContribution / r) / denominator;
  if (!(x > 0)) return { years: null, alreadyThere: false };

  const months = Math.log(x) / Math.log(1 + r);
  if (!Number.isFinite(months) || months <= 0) return { years: null, alreadyThere: false };

  return { years: months / 12, alreadyThere: false };
}

/** Whole-years-old age as of `asOf` — accounts for whether the birthday has happened yet this year, not just a naive year subtraction. */
export function ageAsOf(birthDate: string, asOf: string): number {
  const birth = new Date(birthDate + "T00:00:00Z");
  const today = new Date(asOf + "T00:00:00Z");
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export interface FireAgeResult {
  age: number; // fractional — e.g. 42.3
  year: number; // calendar year, rounded
}

/** Given the user's current (whole-years) age and yearsToFire's result, the fractional age and calendar year they'll hit their FIRE number. */
export function fireAgeAndYear(currentAge: number, yearsToFire: number, asOf: string): FireAgeResult {
  const currentYear = new Date(asOf + "T00:00:00Z").getUTCFullYear();
  return { age: currentAge + yearsToFire, year: currentYear + Math.round(yearsToFire) };
}

export interface ProjectionPoint {
  year: number;
  projectedValue: number;
}

export interface ProjectionSeriesParams {
  currentValue: number;
  monthlyContribution: number;
  annualReturnRate: number;
  horizonYears: number;
}

/** Yearly projected-value points from now (year 0) through `horizonYears`, using the same compounding as `yearsToFire`. */
export function projectionSeries({ currentValue, monthlyContribution, annualReturnRate, horizonYears }: ProjectionSeriesParams): ProjectionPoint[] {
  const monthlyRate = annualReturnRate / 12;
  const years = Math.max(0, Math.round(horizonYears));
  const points: ProjectionPoint[] = [];
  for (let year = 0; year <= years; year++) {
    points.push({ year, projectedValue: futureValue(currentValue, monthlyContribution, monthlyRate, year * 12) });
  }
  return points;
}

/**
 * Return after inflation (Fisher): (1 + market) / (1 + inflation) − 1.
 * Spending is in today's dollars, so the projection must grow in today's
 * dollars too -- mixing a nominal return with today's spending overstates
 * progress by years.
 */
export function realReturn(marketReturn: number, inflation: number): number {
  return (1 + marketReturn) / (1 + inflation) - 1;
}

/** Monthly saving needed to grow `currentValue` to `targetValue` in `years` at `annualReturnRate`; 0 if already enough. */
export function requiredMonthlySaving(currentValue: number, targetValue: number, annualReturnRate: number, years: number): number {
  const months = Math.round(years * 12);
  if (months <= 0) return Math.max(0, targetValue - currentValue);
  const r = annualReturnRate / 12;
  const grown = r === 0 ? currentValue : currentValue * Math.pow(1 + r, months);
  const gap = targetValue - grown;
  if (gap <= 0) return 0;
  return r === 0 ? gap / months : (gap * r) / (Math.pow(1 + r, months) - 1);
}

export interface FirePlanInput {
  currentValue: number;
  monthlyContribution: number;
  /** After inflation. */
  annualReturnRate: number;
  annualExpenses: number;
  swr: number;
}

export interface Milestone {
  key: "p25" | "p50" | "p75" | "lean" | "coast" | "fire";
  label: string;
  /** Cents. */
  value: number;
  /** Years from now; 0 when reached, null when unreachable. */
  years: number | null;
  reached: boolean;
  detail?: string;
}

/** Spending fraction used for "Lean FIRE". */
const LEAN_SHARE = 0.75;
/** Age Coast FIRE assumes you'd retire by if you stopped saving. */
export const COAST_AGE = 65;

/**
 * Checkpoints on the way, soonest first: 25/50/75% of the target, Lean
 * FIRE (75% of spending), Coast FIRE (enough today to reach the target by
 * 65 with no more saving -- only with a known age), and FIRE itself.
 */
export function fireMilestones(p: FirePlanInput, currentAge: number | null): Milestone[] {
  const target = fireNumber(p.annualExpenses, p.swr);
  const when = (value: number) => {
    const r = yearsToFire({ currentValue: p.currentValue, monthlyContribution: p.monthlyContribution, annualReturnRate: p.annualReturnRate, targetValue: value });
    return { years: r.alreadyThere ? 0 : r.years, reached: r.alreadyThere };
  };
  const list: Milestone[] = [
    { key: "p25", label: "25%", value: target * 0.25, ...when(target * 0.25) },
    { key: "p50", label: "50%", value: target * 0.5, ...when(target * 0.5) },
    { key: "p75", label: "75%", value: target * 0.75, ...when(target * 0.75) },
    { key: "lean", label: "Lean FIRE", value: target * LEAN_SHARE, detail: `${Math.round(LEAN_SHARE * 100)}% of your spending`, ...when(target * LEAN_SHARE) },
    { key: "fire", label: "FIRE", value: target, ...when(target) },
  ];
  if (currentAge != null && currentAge < COAST_AGE && p.annualReturnRate > -1) {
    const coast = target / Math.pow(1 + p.annualReturnRate, COAST_AGE - currentAge);
    list.push({ key: "coast", label: "Coast FIRE", value: coast, detail: `Stop saving, still retire at ${COAST_AGE}`, ...when(coast) });
  }
  // At a 75% Lean share, "75%" and Lean FIRE are the same amount; keep Lean.
  return list
    .filter((m) => !(m.key === "p75" && LEAN_SHARE === 0.75))
    .sort((a, b) => (a.years ?? Infinity) - (b.years ?? Infinity));
}

export interface WhatIf {
  label: string;
  /** Positive = sooner, negative = later; null when either side is unreachable. */
  yearsSooner: number | null;
}

/** How much each lever moves the date, in years. */
export function fireWhatIfs(p: FirePlanInput): WhatIf[] {
  const years = (q: FirePlanInput) => {
    const r = yearsToFire({ currentValue: q.currentValue, monthlyContribution: q.monthlyContribution, annualReturnRate: q.annualReturnRate, targetValue: fireNumber(q.annualExpenses, q.swr) });
    return r.alreadyThere ? 0 : r.years;
  };
  const base = years(p);
  const delta = (q: FirePlanInput) => {
    const y = years(q);
    return base == null || y == null ? null : base - y;
  };
  return [
    { label: "Save $250 more a month", yearsSooner: delta({ ...p, monthlyContribution: p.monthlyContribution + 25_000 }) },
    { label: "Spend $2,000 less a year", yearsSooner: delta({ ...p, annualExpenses: Math.max(0, p.annualExpenses - 200_000) }) },
    { label: "Returns 1% lower", yearsSooner: delta({ ...p, annualReturnRate: p.annualReturnRate - 0.01 }) },
    { label: "Withdraw at 3.5%", yearsSooner: p.swr === 0.035 ? null : delta({ ...p, swr: 0.035 }) },
  ];
}
