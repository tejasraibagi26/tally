/**
 * Pure rules behind the Tally Pop preview's extra Overview pieces (web now,
 * mobile later): the greeting, the "left to spend" line, the on-pace days
 * and how a count is drawn as tally marks. Callers pass "today" as
 * YYYY-MM-DD in the user's zone so nothing here reads the clock.
 */
import type { MonthSummary } from "./budgetView";

/** "Morning!" / "Afternoon!" / "Evening!" for an hour 0-23 in the user's zone. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Morning!";
  if (hour >= 12 && hour < 17) return "Afternoon!";
  return "Evening!";
}

/**
 * The one line under the greeting: the number first, then the plain read.
 * "$459.45 left for 6 days. About $76 a day." Null with nothing budgeted.
 */
export function leftToSpendLine(summary: MonthSummary, formatMoney: (cents: number) => string): string | null {
  if (summary.budgeted <= 0) return null;
  const days = summary.daysLeft;
  const dayWord = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (summary.left < 0) {
    const over = `${formatMoney(-summary.left)} over budget`;
    return days != null && days > 0 ? `${over}, with ${dayWord(days)} to go.` : `${over} this month.`;
  }
  if (summary.left === 0) return "Budget spent in full this month.";
  if (days == null || days === 0) return `${formatMoney(summary.left)} left this month.`;
  const perDay = summary.perDay != null ? ` About ${formatMoney(Math.floor(summary.perDay / 100) * 100)} a day.` : "";
  return `${formatMoney(summary.left)} left for ${dayWord(days)}.${perDay}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Finished days this month whose spend stayed at or under an even daily
 * pace (the month's budget / its days) -- every such day, not just a run:
 * a day over pace no longer resets the count to 0. Today doesn't count yet:
 * it isn't over. `dailySpend` holds spend in cents by YYYY-MM-DD; a missing
 * day spent nothing.
 */
export function onPaceDays(dailySpend: Record<string, number>, dailyPace: number, today: string, monthStart: string): number {
  if (dailyPace <= 0) return 0;
  let days = 0;
  for (let day = addDays(today, -1); day >= monthStart; day = addDays(day, -1)) {
    if ((dailySpend[day] ?? 0) <= dailyPace) days++;
  }
  return days;
}

/** Days of the month that have finished (today isn't over). */
export function finishedDays(today: string): number {
  return Math.max(0, Number(today.slice(8, 10)) - 1);
}

/**
 * The month's first day: no day of it has finished, so the streak is 0 by
 * definition -- not because yesterday (last month) went over. The card says
 * "New month" instead of a zero and a scolding.
 */
export function isFirstDayOfMonth(today: string): boolean {
  return today.slice(8, 10) === "01";
}

/** The On-pace card's line, shared by web and mobile. */
export function onPaceLine(days: number, dailyPace: number, today: string, formatMoney: (cents: number) => string): string {
  const pace = formatMoney(dailyPace);
  if (isFirstDayOfMonth(today)) return `Stay under ${pace} today and tomorrow starts your count.`;
  const finished = finishedDays(today);
  if (days === 0) return `No days under your ${pace} daily pace yet this month. Today's a fresh start.`;
  if (days >= finished) return `Every day so far this month under your ${pace} daily pace.`;
  return `${days} of ${finished} days this month under your ${pace} daily pace.`;
}

/** A count as tally marks: full groups of five (four strokes + a crossing) and the strokes left over. */
export function tallyGroups(count: number): { full: number; rest: number } {
  const n = Math.max(0, Math.floor(count));
  return { full: Math.floor(n / 5), rest: n % 5 };
}
