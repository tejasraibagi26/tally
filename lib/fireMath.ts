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
