import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { budgetSetupOptions, getBudgetsForMonth, shiftMonth, unbudgetedSpend } from "@/lib/budgets";
import { monthLastDay } from "@tally/core/budgetMath";
import type { MonthContext } from "@tally/core/budgetView";
import { MonthStepper, PageHeader } from "@/components/ui/PageHeader";
import { AddBudgetForm } from "@/components/budgets/AddBudgetForm";
import { BudgetsView } from "@/components/budgets/BudgetsView";
import { currentMonthFor, todayFor } from "@/lib/userTimezone";

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const [currentMonth, today] = await Promise.all([currentMonthFor(userId), todayFor(userId)]);
  const month = /^\d{4}-\d{2}-01$/.test(sp.month ?? "") ? (sp.month as string) : currentMonth;

  const budgets = await getBudgetsForMonth(userId, month);
  const budgetedCategoryIds = budgets.map((b) => b.categoryId);
  const [availableCategories, unbudgeted, setup] = await Promise.all([
    db.query.categories.findMany({
      where: and(
        eq(schema.categories.kind, "expense"),
        or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
        budgetedCategoryIds.length > 0 ? notInArray(schema.categories.id, budgetedCategoryIds) : undefined,
      ),
      orderBy: (c, { asc }) => [asc(c.name)],
    }),
    unbudgetedSpend(userId, month, budgets),
    budgets.length === 0 ? budgetSetupOptions(userId, month) : Promise.resolve(null),
  ]);

  // Pace and projection only mean something for the month in progress (WORK.md §9).
  const daysInMonth = new Date(monthLastDay(month) + "T00:00:00Z").getUTCDate();
  const ctx: MonthContext =
    month === currentMonth
      ? { phase: "current", daysElapsed: Number(today.slice(8, 10)), daysInMonth }
      : { phase: month < currentMonth ? "past" : "future" };
  const daysLeft = ctx.phase === "current" ? daysInMonth - ctx.daysElapsed! : null;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Budgets"
        meta={[
          budgets.length > 0 && `${budgets.length} ${budgets.length === 1 ? "category" : "categories"} budgeted`,
          daysLeft != null && (daysLeft === 0 ? "Last day of the month" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`),
          ctx.phase === "past" && "Finished",
        ]}
        actions={
          <>
            <MonthStepper label={monthLabel(month)} prevHref={`/budgets?month=${shiftMonth(month, -1)}`} nextHref={`/budgets?month=${shiftMonth(month, 1)}`} />
            <AddBudgetForm month={month} monthLabel={monthLabel(month)} categories={availableCategories} />
          </>
        }
      />
      <BudgetsView
        month={month}
        ctx={ctx}
        budgets={budgets}
        unbudgeted={unbudgeted}
        setup={setup && { copy: setup.copy && { fromMonth: setup.copy.fromMonth, count: setup.copy.count, total: setup.copy.total }, average: setup.average && { count: setup.average.count, total: setup.average.total } }}
      />
    </div>
  );
}
