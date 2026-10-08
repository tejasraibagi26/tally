import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { liveAccount } from "@/lib/liveAccounts";
import { trailingAnnualCashFlowEstimate } from "@/lib/analytics";
import { latestHoldingsForUser } from "@/lib/portfolio";
import { accountDisplayName } from "@tally/core/accountName";
import { toNetWorthCurrency } from "@tally/core/fx";

export interface FireAccount {
  id: string;
  name: string;
  /** Cents, converted to the net-worth currency. */
  value: number;
  excluded: boolean;
}

export interface FireSettingsView {
  swr: number;
  /** Market return, before inflation. */
  expectedReturn: number;
  inflation: number;
  annualExpensesOverride: number | null;
  monthlyContributionOverride: number | null;
  excludedAccountIds: string[];
}

export interface FireInputs {
  /** Investment accounts minus any the user excluded, converted to CAD. */
  investedToday: number;
  accounts: FireAccount[];
  defaultAnnualExpenses: number;
  defaultMonthlyContribution: number;
  /** Months of real transaction history behind the defaults (max 12). */
  coveredMonths: number;
  settings: FireSettingsView | null;
}

/**
 * Everything the FIRE planner and the monthly recap start from, in one
 * place. "Invested today" uses the same converted holdings as the
 * Investments page (an investment account with no holdings falls back to
 * its converted balance), so a USD account is no longer added as if it
 * were CAD.
 */
export async function fireInputs(userId: string): Promise<FireInputs> {
  const [accounts, holdings, cashFlow, [row]] = await Promise.all([
    db.query.accounts.findMany({ where: and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "investment"), liveAccount) }),
    latestHoldingsForUser(userId),
    trailingAnnualCashFlowEstimate(userId, 12),
    db.select().from(schema.fireSettings).where(eq(schema.fireSettings.userId, userId)).limit(1),
  ]);

  const settings: FireSettingsView | null = row
    ? {
        swr: Number(row.swr),
        expectedReturn: Number(row.expectedReturn),
        inflation: Number(row.inflation),
        annualExpensesOverride: row.annualExpensesOverride,
        monthlyContributionOverride: row.monthlyContributionOverride,
        excludedAccountIds: row.excludedAccountIds ?? [],
      }
    : null;
  const excluded = new Set(settings?.excludedAccountIds ?? []);

  const holdingsValue = new Map<string, number>();
  for (const h of holdings) holdingsValue.set(h.accountId, (holdingsValue.get(h.accountId) ?? 0) + h.institutionValue);

  const fireAccounts: FireAccount[] = await Promise.all(
    accounts.map(async (a) => ({
      id: a.id,
      name: accountDisplayName(a.name, a.nickname),
      value: holdingsValue.get(a.id) ?? (a.currentBalance != null ? await toNetWorthCurrency(a.currentBalance, a.currency) : 0),
      excluded: excluded.has(a.id),
    })),
  );

  return {
    investedToday: fireAccounts.filter((a) => !a.excluded).reduce((s, a) => s + a.value, 0),
    accounts: fireAccounts.sort((a, b) => b.value - a.value),
    defaultAnnualExpenses: cashFlow.expenses,
    defaultMonthlyContribution: Math.max(0, Math.round((cashFlow.income - cashFlow.expenses) / 12)),
    coveredMonths: cashFlow.coveredMonths,
    settings,
  };
}
