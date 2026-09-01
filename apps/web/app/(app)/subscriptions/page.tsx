import { and, eq, isNull, or } from "drizzle-orm";
import { Repeat } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddBillForm } from "@/components/subscriptions/AddBillForm";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { accountDisplayName } from "@tally/core/accountName";

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

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
      accountName: schema.accounts.name,
      accountNickname: schema.accounts.nickname,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
      categoryColorSlot: schema.categories.colorSlot,
    })
    .from(schema.recurringStreams)
    .leftJoin(schema.accounts, eq(schema.recurringStreams.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.recurringStreams.categoryId, schema.categories.id))
    .where(eq(schema.recurringStreams.userId, userId));

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

  // A manual override (rent prepaid in lump sums, etc.) counts as still active
  // for this total even if the gap-based detector marked it cancelled/at_risk —
  // the user has confirmed it's a real ongoing bill, just off the algorithm's cadence.
  const activeExpenseStreams = streams.filter((s) => (s.status !== "cancelled" || s.manualNextDueDate != null) && s.averageAmount < 0);
  const monthlyTotal = activeExpenseStreams.reduce((sum, s) => sum + Math.abs(s.averageAmount) * (FREQUENCY_MONTHLY_MULTIPLIER[s.frequency] ?? 1), 0);
  const annualTotal = monthlyTotal * 12;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">Subscriptions &amp; recurring</h1>
        <AddBillForm accounts={accounts} categories={expenseCategories} />
      </div>

      {streams.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={Repeat}
            animation="spin"
            title="Nothing detected yet"
            description="Recurring charges and income show up here automatically once a merchant, account, and amount repeat at least 3 times with a stable interval. Paid in irregular lump sums (e.g. rent prepaid ahead)? Add it manually above instead."
          />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col sm:flex-row">
            <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly (subscriptions)</span>
              <span className="font-display text-3xl text-text tabular">{formatCents(monthlyTotal)}</span>
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
