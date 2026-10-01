import { and, eq, isNull, or } from "drizzle-orm";
import { Repeat } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddBillForm } from "@/components/subscriptions/AddBillForm";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { accountDisplayName } from "@tally/core/accountName";
import { todayFor } from "@/lib/userTimezone";
import { isActiveExpenseStream, subscriptionsMonthlyTotal } from "@tally/core/subscriptionMath";

export default async function SubscriptionsPage() {
  const userId = await requireUserId();

  const streams = await db
    .select({
      id: schema.recurringStreams.id,
      description: schema.recurringStreams.description,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
      frequency: schema.recurringStreams.frequency,
      predictedNextDate: schema.recurringStreams.predictedNextDate,
      manualNextDueDate: schema.recurringStreams.manualNextDueDate,
      status: schema.recurringStreams.status,
      isManual: schema.recurringStreams.isManual,
      amortizeMonthly: schema.recurringStreams.amortizeMonthly,
      amortizeMonths: schema.recurringStreams.amortizeMonths,
      accountName: schema.accounts.name,
      accountNickname: schema.accounts.nickname,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
      categoryColorSlot: schema.categories.colorSlot,
    })
    .from(schema.recurringStreams)
    .leftJoin(schema.accounts, eq(schema.recurringStreams.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.recurringStreams.categoryId, schema.categories.id))
    .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt)));

  const accountRows = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname, mask: schema.accounts.mask })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  const accounts = accountRows.map((a) => ({ id: a.id, name: accountDisplayName(a.name, a.nickname), mask: a.mask }));
  const expenseCategories = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .where(and(eq(schema.categories.kind, "expense"), or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))));

  streams.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));

  // Shared with the recap email and mobile (@tally/core/subscriptionMath).
  const activeExpenseStreams = streams.filter(isActiveExpenseStream);
  const { monthlyTotal, activeCount } = subscriptionsMonthlyTotal(activeExpenseStreams);
  const hasManualBills = activeExpenseStreams.some((s) => s.isManual);
  const annualTotal = monthlyTotal * 12;

  // In the user's timezone, matching how "today" is read everywhere else.
  const today = await todayFor(userId);
  const weekOut = new Date(Date.parse(today + "T00:00:00Z") + 7 * 86_400_000).toISOString().slice(0, 10);
  const dueThisWeek = activeExpenseStreams.filter((s) => {
    const next = s.manualNextDueDate ?? s.predictedNextDate;
    return next != null && next >= today && next <= weekOut;
  }).length;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Subscriptions & recurring"
        meta={[streams.length > 0 && `${activeCount} subscription${activeCount === 1 ? "" : "s"}`, dueThisWeek > 0 && `${dueThisWeek} due in the next 7 days`]}
        actions={<AddBillForm accounts={accounts} categories={expenseCategories} />}
      />

      {streams.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={Repeat}
            animation="spin"
            title="Nothing detected yet"
            description="Recurring charges and income show up here automatically once a merchant, account, and amount repeat at least 3 times with a stable interval. Paid in irregular lump sums (e.g. rent prepaid ahead)? Use Add a bill to track it manually."
          />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col sm:flex-row">
            <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly (subscriptions)</span>
              <span className="font-display text-3xl text-text tabular">{formatCents(monthlyTotal)}</span>
              {hasManualBills && <span className="text-xs text-text-3">Bills you added yourself, like rent, aren&apos;t included</span>}
            </div>
            <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Annualized</span>
              <span className="font-display text-3xl text-text tabular">{formatCents(annualTotal)}</span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SubscriptionsTable streams={streams} />
          </Card>
        </>
      )}
    </div>
  );
}
