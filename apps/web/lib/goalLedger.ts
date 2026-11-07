import { cashFlowTrend } from "@/lib/analytics";
import { currentMonthFor } from "@/lib/userTimezone";
import { shiftMonth } from "@tally/core/budgetMath";
import { PACE_MONTHS } from "@tally/core/goalMath";
import type { LedgerMonth } from "@/components/goalview/SavingLedger";

/** How many months the saving record shows, the month in progress included. */
export const LEDGER_MONTHS = 6;

/**
 * The saving record behind the goal view's accountability band.
 *
 * No new pipeline: cashFlowTrend already returns income and spend per month,
 * and income minus spend for a month IS what was saved that month, by the
 * same definition goalMath's savingPace averages. This only marks which
 * months are the PACE_MONTHS full ones that the pace (and so the verdict
 * above) is measured over.
 */
export async function savingLedger(userId: string, months = LEDGER_MONTHS): Promise<LedgerMonth[]> {
  const [series, current] = await Promise.all([cashFlowTrend(userId, months), currentMonthFor(userId)]);
  // The pace window is the PACE_MONTHS full months before this one.
  const windowStart = shiftMonth(current, -PACE_MONTHS);
  return series.map((m) => ({
    month: m.month,
    saved: m.income - m.spend,
    inProgress: m.month === current,
    inPaceWindow: m.month >= windowStart && m.month < current,
  }));
}
