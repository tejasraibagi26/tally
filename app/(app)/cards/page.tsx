import Link from "next/link";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { formatCents, formatPercent } from "@/lib/money";
import { creditCardsForUser, utilizationFor } from "@/lib/liabilities";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreditLimitEditor } from "@/components/cards/CreditLimitEditor";
import { cn } from "@/lib/cn";

const APR_TYPE_LABEL: Record<string, string> = {
  purchase_apr: "Purchase APR",
  cash_apr: "Cash advance APR",
  balance_transfer_apr: "Balance transfer APR",
  special: "Special APR",
};

function relativeDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const due = new Date(dateStr + "T00:00:00");
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

export default async function CardsPage() {
  const userId = await requireUserId();
  const cards = await creditCardsForUser(userId);
  const utilization = utilizationFor(cards);
  // utilization.totalBalance is scoped to the ratio (only cards with a known
  // limit) — the summary tile needs every card's balance, limit or not.
  const totalBalance = cards.reduce((sum, c) => sum + c.currentBalance, 0);

  if (cards.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text">Credit cards</h1>
        <Card className="p-10">
          <EmptyState
            icon={CreditCardIcon}
            title="No credit cards connected"
            description="Connect one and its APR, statement balance, and due dates show up right here."
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

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Credit cards</h1>

      <Card className="flex flex-col sm:flex-row">
        <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Total balance</span>
          <span className="font-display text-3xl text-negative tabular money">{formatCents(totalBalance)}</span>
        </div>
        <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Overall utilization</span>
          <span className="font-display text-3xl text-text tabular">
            {utilization.utilization != null ? formatPercent(utilization.utilization) : "Unknown"}
          </span>
          {utilization.excludedCount > 0 && (
            <span className="text-xs text-text-3">
              {utilization.excludedCount} card{utilization.excludedCount === 1 ? "" : "s"} excluded — limit not reported
            </span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {cards.map((card, index) => {
          const cardUtilization = card.creditLimit ? card.currentBalance / card.creditLimit : null;
          const liability = card.liability;
          const dueLabel = relativeDueDate(liability?.nextPaymentDueDate ?? null);
          const aprs = (liability?.aprs as { apr_percentage: number; apr_type: string }[] | null) ?? [];

          // Same convention as the Accounts page: a lone card, or the
          // unpaired last card in an odd-sized (3+) grid, sizes to its own
          // content; every other card shares a fixed default height with its
          // row partner, and overlong statement/APR details scroll inside it
          // instead of growing the card and breaking row alignment.
          const isSoleCard = cards.length === 1;
          const isUnpairedTail = cards.length > 2 && cards.length % 2 === 1 && index === cards.length - 1;
          const capped = !isSoleCard && !isUnpairedTail;

          return (
            <Card key={card.accountId} className={cn(isSoleCard && "lg:col-span-2", capped && "h-[440px]")}>
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 p-4 border-b border-border flex-none">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-semibold text-base text-text truncate">{card.name}</span>
                    <span className="font-mono text-xs text-text-3">····{card.mask ?? "----"}</span>
                  </div>
                  {liability?.isOverdue && <StatusBadge status="critical" label="Overdue" />}
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 border-b border-border flex-none">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-3 uppercase tracking-wide">Balance</span>
                    <span className="text-[19px] text-text tabular money">{formatCents(card.currentBalance)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-3 uppercase tracking-wide">Utilization</span>
                    <span className="text-[19px] text-text tabular">
                      {cardUtilization != null ? formatPercent(cardUtilization) : "No limit reported"}
                    </span>
                    {(card.creditLimit == null || card.creditLimitIsManual) && (
                      <CreditLimitEditor accountId={card.accountId} creditLimitIsManual={card.creditLimitIsManual} />
                    )}
                  </div>
                </div>

                <div className={capped ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
                  {liability ? (
                    <div className="flex flex-col gap-3 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-text-3 uppercase tracking-wide">Statement balance</span>
                          <span className="text-[15px] text-text tabular money">
                            {liability.lastStatementBalance != null ? formatCents(liability.lastStatementBalance) : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-text-3 uppercase tracking-wide">Minimum payment</span>
                          <span className="text-[15px] text-text tabular money">
                            {liability.minimumPaymentAmount != null ? formatCents(liability.minimumPaymentAmount) : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-3 uppercase tracking-wide">Next payment due</span>
                        <span className={`text-[15px] tabular ${liability.isOverdue ? "text-negative" : "text-text"}`}>
                          {liability.nextPaymentDueDate ?? "—"} {dueLabel && `· ${dueLabel}`}
                        </span>
                      </div>
                      {aprs.length > 0 && (
                        <div className="flex flex-col gap-1 pt-2 border-t border-border">
                          {aprs.map((a) => (
                            <div key={a.apr_type} className="flex items-center justify-between text-[13.5px]">
                              <span className="text-text-2">{APR_TYPE_LABEL[a.apr_type] ?? a.apr_type}</span>
                              <span className="text-text tabular">{a.apr_percentage.toFixed(2)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-text-2 text-[15px]">No liability details reported for this card yet.</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
