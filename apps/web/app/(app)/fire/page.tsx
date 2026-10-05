import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { fireInputs } from "@/lib/fire";
import { todayFor } from "@/lib/userTimezone";
import { MOCK_MODE } from "@/lib/config";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LinkButton } from "@/components/plaid/LinkButton";
import { FirePlanner } from "@/components/fire/FirePlanner";

export default async function FirePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const userId = await requireUserId();
  const { start } = await searchParams;
  const [inputs, [user], anyAccount, today] = await Promise.all([
    fireInputs(userId),
    db.select({ birthDate: schema.users.birthDate }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db.query.accounts.findFirst({ where: eq(schema.accounts.userId, userId) }),
    todayFor(userId),
  ]);

  // No investment accounts: offer to connect one, or to plan from $0
  // (?start=zero) so someone without a brokerage still gets an answer.
  if (inputs.accounts.length === 0 && start !== "zero") {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <PageHeader title="Early retirement" />
        <Card className="p-8 lg:p-10 flex flex-col items-start gap-4 max-w-[600px]">
          <h2 className="m-0 font-display text-[28px] font-normal text-text">When could you stop working?</h2>
          <p className="m-0 text-[15px] leading-relaxed text-text-2">
            {anyAccount
              ? "Tally can work it out from your spending. Connect a brokerage so it also knows what you've invested, or start from $0."
              : "Connect your bank and brokerage, and Tally works it out from your spending and investments. Or start from $0."}
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton mode="create" label="Connect a brokerage" mock={MOCK_MODE} />
            <a href="/fire?start=zero" className="h-9 px-4 rounded-control bg-brand-subtle text-brand text-[15px] font-medium inline-flex items-center">
              Start from $0
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader title="Early retirement" meta={["In today's dollars", "Saves as you go"]} />
      <FirePlanner
        investedTodayAll={inputs.investedToday}
        accounts={inputs.accounts}
        defaultAnnualExpenses={inputs.defaultAnnualExpenses}
        defaultMonthlyContribution={inputs.defaultMonthlyContribution}
        coveredMonths={inputs.coveredMonths}
        saved={inputs.settings}
        birthDate={user?.birthDate ?? null}
        today={today}
      />
    </div>
  );
}
