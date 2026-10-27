/**
 * Pure rules behind the Tally Pop preview's extra Overview pieces (web now,
 * mobile later): the greeting, the "left to spend" line, the on-pace streak
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
 * Finished days in a row, ending yesterday, whose spend stayed at or under
 * an even daily pace (the month's budget / its days). Today doesn't count
 * yet: it isn't over. Stops at the first day over pace or the month's
 * first day. `dailySpend` holds spend in cents by YYYY-MM-DD; a missing day
 * spent nothing.
 */
export function onPaceStreak(dailySpend: Record<string, number>, dailyPace: number, today: string, monthStart: string): number {
  if (dailyPace <= 0) return 0;
  let streak = 0;
  for (let day = addDays(today, -1); day >= monthStart; day = addDays(day, -1)) {
    if ((dailySpend[day] ?? 0) > dailyPace) break;
    streak++;
  }
  return streak;
}

/** A count as tally marks: full groups of five (four strokes + a crossing) and the strokes left over. */
export function tallyGroups(count: number): { full: number; rest: number } {
  const n = Math.max(0, Math.floor(count));
  return { full: Math.floor(n / 5), rest: n % 5 };
}
