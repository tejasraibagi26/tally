import { eq } from "drizzle-orm";
import { Repeat } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

function statusBadge(status: string): Status {
  if (status === "active") return "good";
  if (status === "at_risk") return "warning";
  return "critical"; // cancelled
}

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
      status: schema.recurringStreams.status,
      accountName: schema.accounts.name,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
      categoryColorSlot: schema.categories.colorSlot,
    })
    .from(schema.recurringStreams)
    .leftJoin(schema.accounts, eq(schema.recurringStreams.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.recurringStreams.categoryId, schema.categories.id))
    .where(eq(schema.recurringStreams.userId, userId));

  streams.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));

  const activeExpenseStreams = streams.filter((s) => s.status !== "cancelled" && s.averageAmount < 0);
  const monthlyTotal = activeExpenseStreams.reduce((sum, s) => sum + Math.abs(s.averageAmount) * (FREQUENCY_MONTHLY_MULTIPLIER[s.frequency] ?? 1), 0);
  const annualTotal = monthlyTotal * 12;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Subscriptions &amp; recurring</h1>

      {streams.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={Repeat}
            animation="spin"
            title="Nothing detected yet"
            description="Recurring charges and income show up here automatically once a merchant, account, and amount repeat at least 3 times with a stable interval."
          />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col sm:flex-row">
            <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly (subscriptions)</span>
              <span className="font-display text-3xl text-text tabular money">{formatCents(monthlyTotal)}</span>
            </div>
            <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Annualized</span>
              <span className="font-display text-3xl text-text tabular money">{formatCents(annualTotal)}</span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[minmax(180px,1fr)_140px_150px_130px_130px_120px_130px] gap-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 min-w-[990px]">
                <span>Merchant</span>
                <span>Category</span>
                <span>Account</span>
                <span>Cadence</span>
                <span className="text-right">Amount</span>
                <span>Next date</span>
                <span>Status</span>
              </div>
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[minmax(180px,1fr)_140px_150px_130px_130px_120px_130px] gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0 min-w-[990px]"
                >
                  <span className="text-[15px] text-text truncate">{s.description ?? s.merchantKey}</span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    {s.categoryName ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${s.categoryColorSlot})` }} />
                        <span className="text-[13px] text-text-2 truncate">{s.categoryName}</span>
                      </>
                    ) : (
                      <span className="text-[13px] text-text-3">—</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-text-2 truncate">
                    {s.accountName ? `${s.accountName} ····${s.accountMask ?? "----"}` : "—"}
                  </span>
                  <span className="text-[13.5px] text-text-2">{FREQUENCY_LABEL[s.frequency] ?? s.frequency}</span>
                  <span className={`text-right text-[15px] tabular money ${s.averageAmount > 0 ? "text-positive" : "text-text"}`}>
                    {formatCents(s.averageAmount, { signed: true })}
                  </span>
                  <span className="font-mono text-xs text-text-2 tabular">{s.predictedNextDate ?? "—"}</span>
                  <StatusBadge
                    status={statusBadge(s.status)}
                    label={s.status === "active" ? "Active" : s.status === "at_risk" ? "At risk" : "Cancelled"}
                  />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
