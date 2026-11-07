import { requireUserId } from "@/lib/session";
import { loansForUser, loanLabel } from "@/lib/loans";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@tally/core/fx";
import { dollars, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { PlaidButton } from "@/components/new/PlaidButton";
import { MOCK_MODE } from "@/lib/config";

const KIND: Record<string, string> = { mortgage: "Mortgage", student: "Student loan", auto: "Car loan", line_of_credit: "Line of credit" };

export default async function NewLoansPage() {
  const userId = await requireUserId();
  const loans = await loansForUser(userId);
  const converted = await Promise.all(loans.map((l) => toNetWorthCurrency(l.balance, l.currency)));
  const total = converted.reduce((s, v) => s + v, 0);
  const monthly = loans.reduce((s, l) => s + (l.detail?.nextPaymentAmount ?? 0), 0);

  return (
    <main className="tn-main">
      <NewSubNav section="everything" />

      {loans.length === 0 ? (
        <div className="tn-card tn-empty">
          <p style={{ margin: "0 0 16px" }}>No loans connected. If you have a mortgage, car or student loan, connect the lender to see what&apos;s left.</p>
          <PlaidButton mode="create" label="Connect a lender" mock={MOCK_MODE} />
        </div>
      ) : (
        <>
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tn-muted">Left to pay on your loans</span>
            <span className="tn-disp money" style={{ fontSize: "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 1 }}>
              {dollars(total)}
            </span>
            {monthly > 0 && (
              <span style={{ fontSize: 17, color: "var(--tn-ink-3)" }}>
                About <span className="money">{dollars(monthly)}</span> a month in payments.
              </span>
            )}
          </section>

          <section className="tn-section" style={{ gap: 12 }}>
            {loans.map((l) => {
              const d = l.detail;
              const paidOff = d?.originationPrincipal && d.originationPrincipal > 0 ? Math.max(0, Math.min(1, 1 - l.balance / d.originationPrincipal)) : null;
              const sentence = d?.isOverdue
                ? `Overdue${d.pastDueAmount ? ` by ${dollars(d.pastDueAmount)}` : ""}. Pay it as soon as you can.`
                : d?.nextPaymentDueDate && d.nextPaymentAmount
                  ? `Next payment ${dollars(d.nextPaymentAmount)} on ${shortDate(d.nextPaymentDueDate)}.`
                  : l.paymentDueDay
                    ? `Due on day ${l.paymentDueDay === 0 ? "last" : l.paymentDueDay} of each month.`
                    : "The lender hasn't shared a payment date.";
              return (
                <div key={l.accountId} className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 22px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="tn-row-title" style={{ fontSize: 16 }}>
                        {loanLabel(l)}
                      </div>
                      <div className="tn-row-sub">
                        {[d ? (KIND[d.kind] ?? "Loan") : "Loan", l.institutionName, d?.interestRate && `${Number(d.interestRate).toFixed(2)}% interest`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="tn-disp money" style={{ fontSize: 26, fontWeight: 700 }}>
                      {dollars(l.balance)}
                      {l.currency !== NET_WORTH_CURRENCY ? ` ${l.currency}` : ""}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, color: d?.isOverdue ? "var(--tn-coral)" : "var(--tn-ink-3)" }}>{sentence}</span>
                  {paidOff != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="tn-bar" style={{ flex: 1 }} aria-hidden="true">
                        <b style={{ width: `${Math.round(paidOff * 100)}%`, background: "var(--tn-lime)" }} />
                      </div>
                      <span className="tn-faint" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {Math.round(paidOff * 100)}% paid off of <span className="money">{dollars(d!.originationPrincipal!)}</span>
                      </span>
                    </div>
                  )}
                  {d?.payoffDate && <span className="tn-faint" style={{ fontSize: 13 }}>Paid off by {new Date(`${d.payoffDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })} at this pace.</span>}
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
