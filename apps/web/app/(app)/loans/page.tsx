import Link from "next/link";
import { AlertTriangle, Banknote } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@tally/core/money";
import { NET_WORTH_CURRENCY } from "@tally/core/fx";
import { loansForUser, loanLabel, type LoanRow } from "@/lib/loans";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Loans · Tally" };

const SUBTYPE_LABEL: Record<string, string> = {
  mortgage: "Mortgage",
  student: "Student loan",
  auto: "Car loan",
  personal: "Personal loan",
  "line of credit": "Line of credit",
  "home equity": "Home equity",
  business: "Business loan",
  commercial: "Commercial loan",
  construction: "Construction loan",
  consumer: "Consumer loan",
  overdraft: "Overdraft",
};

function kindLabel(l: LoanRow): string {
  const key = l.subtype ?? l.detail?.kind ?? "";
  return SUBTYPE_LABEL[key] ?? (key ? key[0]!.toUpperCase() + key.slice(1) : "Loan");
}

function dateLabel(date: string, withYear = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}

function Money({ cents, currency, className }: { cents: number; currency: string; className?: string }) {
  return (
    <span className={`money tabular ${className ?? ""}`}>
      <span>
        {formatCents(cents)}
        {currency !== NET_WORTH_CURRENCY && <span className="text-[0.7em] font-normal text-text-3"> {currency}</span>}
      </span>
    </span>
  );
}

/**
 * Loans: every debt that isn't a credit card (lib/loans.ts) -- mortgage,
 * student, car, personal, lines of credit. Each one's balance already counts
 * against net worth; this shows what each costs and when the next payment
 * is due. Mortgages and student loans carry the lender's detail (rate, next
 * payment, payoff); other loans have only a balance, because Plaid reports
 * nothing more for them. Payments with a known amount also come out of
 * Forecast and Safe to spend.
 */
export default async function LoansPage() {
  const userId = await requireUserId();
  const loans = await loansForUser(userId);

  if (loans.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <PageHeader title="Loans" />
        <Card className="p-10">
          <EmptyState
            icon={Banknote}
            title="No loans connected"
            description="Mortgages, student loans, car and personal loans and lines of credit show up here once their bank is connected, and their balances count against your net worth."
            action={
              <Link href="/accounts" className="text-brand text-[13.5px] font-medium">
                Connect a bank →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  // Totals per currency: a loan is owed in its own currency.
  const totals = new Map<string, number>();
  for (const l of loans) totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.balance);
  const monthly = new Map<string, number>();
  for (const l of loans) {
    if (l.detail?.nextPaymentAmount) monthly.set(l.currency, (monthly.get(l.currency) ?? 0) + l.detail.nextPaymentAmount);
  }
  const overdue = loans.filter((l) => l.detail?.isOverdue);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Loans"
        meta={[
          `${loans.length} loan${loans.length === 1 ? "" : "s"}`,
          loans.some((l) => l.lastSyncedAt) && <SyncFreshness key="sync" syncedAt={loans.map((l) => l.lastSyncedAt)} />,
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">You owe</span>
          {[...totals].map(([currency, cents]) => (
            <Money key={currency} cents={cents} currency={currency} className="ui-page-title text-[34px] leading-tight text-text" />
          ))}
          <span className="text-[13.5px] text-text-2">Counted against your net worth</span>
        </Card>
        <Card className="p-5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">Payments a month</span>
          {monthly.size === 0 ? (
            <span className="ui-page-title text-[34px] leading-tight text-text-3">—</span>
          ) : (
            [...monthly].map(([currency, cents]) => <Money key={currency} cents={cents} currency={currency} className="ui-page-title text-[34px] leading-tight text-text" />)
          )}
          <span className="text-[13.5px] text-text-2">
            {overdue.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-negative">
                <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
                {overdue.length} past due
              </span>
            ) : (
              <Link href="/forecast" className="text-brand font-semibold">
                In Forecast and Safe to spend →
              </Link>
            )}
          </span>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your loans" />
        <ul className="m-0 p-0 list-none divide-y divide-border">
          {loans.map((l) => {
            const d = l.detail;
            const rate = d?.interestRate != null ? `${Number(d.interestRate).toFixed(2)}%` : null;
            return (
              <li key={l.accountId} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-x-6 gap-y-2 px-5 py-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[15px] font-semibold text-text truncate">{loanLabel(l)}</span>
                  <span className="text-[13.5px] text-text-2 truncate">
                    {kindLabel(l)}
                    {l.institutionName ? ` · ${l.institutionName}` : ""}
                  </span>
                </div>
                <Field label="Balance">
                  <Money cents={l.balance} currency={l.currency} className="text-[15px] font-semibold text-text" />
                </Field>
                <Field label="Next payment">
                  {d?.nextPaymentAmount != null ? (
                    <span className="flex flex-col">
                      <Money cents={d.nextPaymentAmount} currency={l.currency} className="text-[15px] text-text" />
                      <span className={d.isOverdue ? "text-[12.5px] font-semibold text-negative" : "text-[12.5px] text-text-3"}>
                        {d.isOverdue ? "Past due" : d.nextPaymentDueDate ? `Due ${dateLabel(d.nextPaymentDueDate)}` : "No due date reported"}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13.5px] text-text-3">Not reported by the lender</span>
                  )}
                </Field>
                <Field label="Rate · paid off">
                  <span className="text-[13.5px] text-text">
                    {rate ?? "—"}
                    {d?.payoffDate ? <span className="text-text-2"> · {dateLabel(d.payoffDate, true)}</span> : null}
                  </span>
                </Field>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="m-0 text-[13.5px] text-text-3 max-w-[70ch]">
        Mortgages and student loans come with the lender&apos;s rate and next payment. For other loans, banks only share the balance.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-text-3">{label}</span>
      {children}
    </div>
  );
}
