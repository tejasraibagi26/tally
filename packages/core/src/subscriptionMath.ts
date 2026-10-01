/**
 * The one definition of "what do my subscriptions cost a month", shared by
 * web's Subscriptions page, the monthly recap email and mobile's
 * Subscriptions screen. Callers pass streams that aren't dismissed (removed
 * by the user); this decides which of those count and what each costs.
 */
export type StreamFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export const FREQUENCY_MONTHLY_MULTIPLIER: Record<StreamFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

export interface StreamCostInput {
  /** Cents; expenses negative. */
  averageAmount: number;
  frequency: StreamFrequency;
  status: "active" | "cancelled" | "at_risk";
  manualNextDueDate: string | null;
  /** Added by hand ("Add a bill", e.g. rent) rather than detected from transactions. */
  isManual: boolean;
  amortizeMonthly: boolean;
  /** Term a spread (prepaid) plan covers: 3/6/9/12. */
  amortizeMonths?: number | null;
}

/**
 * An expense stream that's still going. A manual next-due date counts as
 * still active even if the gap-based detector marked it cancelled: the user
 * has confirmed it's a real ongoing bill, just off the detector's cadence.
 */
export function isActiveExpenseStream(s: StreamCostInput): boolean {
  return (s.status !== "cancelled" || s.manualNextDueDate != null) && s.averageAmount < 0;
}

/**
 * Monthly cost in cents (positive). A spread plan's real cadence is its term
 * -- one charge covers amortizeMonths -- not the detected frequency (the
 * enum has no 6/9-month value), so it's the charge divided by the term.
 */
export function monthlyCost(s: StreamCostInput): number {
  const perMonth = s.amortizeMonthly ? 1 / (s.amortizeMonths || 12) : (FREQUENCY_MONTHLY_MULTIPLIER[s.frequency] ?? 1);
  return Math.abs(s.averageAmount) * perMonth;
}

/**
 * The subscriptions total and count: automatically detected streams only.
 * Bills added by hand (rent, etc.) still show in the list and still get
 * due-date reminders, but they aren't subscriptions, so they're left out.
 */
export function subscriptionsMonthlyTotal(streams: StreamCostInput[]): { activeCount: number; monthlyTotal: number } {
  const active = streams.filter((s) => !s.isManual && isActiveExpenseStream(s));
  return { activeCount: active.length, monthlyTotal: active.reduce((sum, s) => sum + monthlyCost(s), 0) };
}
