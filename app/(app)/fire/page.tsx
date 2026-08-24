import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Flame } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { trailingAnnualCashFlowEstimate } from "@/lib/analytics";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FireCalculator } from "@/components/fire/FireCalculator";

export default async function FirePage() {
  const userId = await requireUserId();

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });

  if (accounts.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text">FIRE calculator</h1>
        <Card className="p-10">
          <EmptyState
            icon={Flame}
            title="Connect an account to get started"
            description="The calculator uses your investable net worth and spending history to seed sensible defaults, which you can always adjust by hand."
            action={
              <Link href="/accounts" className="text-brand text-[13.5px] font-medium">
                Go to Accounts →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const investableNetWorth = accounts.filter((a) => a.type === "investment").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const { income: totalIncome, expenses: defaultAnnualExpenses } = await trailingAnnualCashFlowEstimate(userId, 12);
  const defaultMonthlyContribution = Math.max(0, Math.round((totalIncome - defaultAnnualExpenses) / 12));

  const [savedSettings] = await db
    .select()
    .from(schema.fireSettings)
    .where(and(eq(schema.fireSettings.userId, userId)))
    .limit(1);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">FIRE calculator</h1>

      <Card className="flex flex-col sm:flex-row">
        <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Investable net worth</span>
          <span className="font-display text-3xl text-text tabular money">{formatCents(investableNetWorth)}</span>
        </div>
        <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Trailing 12mo expenses</span>
          <span className="font-display text-3xl text-text tabular money">{formatCents(defaultAnnualExpenses)}</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your FIRE plan" />
        <FireCalculator
          investableNetWorth={investableNetWorth}
          defaultAnnualExpenses={defaultAnnualExpenses}
          defaultMonthlyContribution={defaultMonthlyContribution}
          savedSettings={savedSettings ?? null}
        />
      </Card>
    </div>
  );
}
