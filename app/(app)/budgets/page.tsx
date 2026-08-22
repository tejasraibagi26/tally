import Link from "next/link";
import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import { PiggyBank } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth, shiftMonth } from "@/lib/budgets";
import { monthLastDay } from "@/lib/budgetMath";
import { formatCents } from "@/lib/money";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BudgetRow } from "@/components/budgets/BudgetRow";
import { AddBudgetForm } from "@/components/budgets/AddBudgetForm";

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}-01$/.test(sp.month ?? "") ? (sp.month as string) : currentMonth();

  const budgets = await getBudgetsForMonth(userId, month);
  const budgetedCategoryIds = budgets.map((b) => b.categoryId);

  const availableCategories = await db.query.categories.findMany({
    where: and(
      eq(schema.categories.kind, "expense"),
      or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
      budgetedCategoryIds.length > 0 ? notInArray(schema.categories.id, budgetedCategoryIds) : undefined,
    ),
    orderBy: (c, { asc }) => [asc(c.name)],
  });

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount + b.rolloverFromPrior, 0);
  const totalSpend = budgets.reduce((sum, b) => sum + b.spend, 0);
  const totalRemaining = totalBudgeted - totalSpend;

  // Projection only means something for the month actually in progress (WORK.md §9).
  const isCurrentMonth = month === currentMonth();
  const daysElapsed = isCurrentMonth ? new Date().getUTCDate() : undefined;
  const daysInMonth = isCurrentMonth ? new Date(monthLastDay(month) + "T00:00:00Z").getUTCDate() : undefined;

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-text">Budgets</h1>
          <span className="text-[13.5px] text-text-3">{budgets.length} categories budgeted</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/budgets?month=${shiftMonth(month, -1)}`} className="text-sm text-text-2 px-2">
            ← Prev
          </Link>
          <span className="font-display text-lg text-text min-w-[160px] text-center">{monthLabel(month)}</span>
          <Link href={`/budgets?month=${shiftMonth(month, 1)}`} className="text-sm text-text-2 px-2">
            Next →
          </Link>
        </div>
      </div>

      {budgets.length > 0 && (
        <Card className="flex">
          <div className="flex-1 p-[18px_24px] border-r border-border flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Budgeted</span>
            <span className="font-display text-3xl text-text tabular">{formatCents(totalBudgeted)}</span>
          </div>
          <div className="flex-1 p-[18px_24px] border-r border-border flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Spent</span>
            <span className="font-display text-3xl text-text tabular">{formatCents(totalSpend)}</span>
          </div>
          <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Remaining</span>
            <span className={`font-display text-3xl tabular ${totalRemaining < 0 ? "text-negative" : "text-positive"}`}>
              {formatCents(totalRemaining)}
            </span>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="This month" />
        {budgets.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState icon={PiggyBank} title="No budgets yet" description={`Add one below to start tracking spend against a limit for ${monthLabel(month)}.`} />
          </div>
        ) : (
          budgets.map((b) => <BudgetRow key={b.categoryId} budget={{ ...b, month }} daysElapsed={daysElapsed} daysInMonth={daysInMonth} />)
        )}
        <div className="border-t border-border">
          <AddBudgetForm month={month} categories={availableCategories} />
        </div>
      </Card>
    </div>
  );
}
