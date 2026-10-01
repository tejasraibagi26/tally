/**
 * Calendar dates in the user's own timezone. Servers run in UTC, so a bare
 * `new Date()` flips to the next day (and month) at 8 PM in Toronto -- which
 * moved the default transactions/budgets month to October on the evening of
 * Sep 30. Everything that means "today" or "this month" for a person should
 * go through these.
 */
export const DEFAULT_TIMEZONE = "America/Toronto";

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD for `now` as seen in `timeZone`. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** YYYY-MM-01 of the month `now` falls in, as seen in `timeZone`. */
export function monthStartInZone(timeZone: string, now: Date = new Date()): string {
  return todayInZone(timeZone, now).slice(0, 7) + "-01";
}
