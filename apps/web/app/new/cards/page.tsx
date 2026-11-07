import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { creditCardsForUser, institutionBrands, viewForCard } from "@/lib/liabilities";
import { todayInZone } from "@tally/core/zonedDate";
import { accountDisplayName } from "@tally/core/accountName";
import { NET_WORTH_CURRENCY } from "@tally/core/fx";
import { dollars, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { PlaidButton } from "@/components/new/PlaidButton";
import { MOCK_MODE } from "@/lib/config";

export default async function NewCardsPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const cards = await creditCardsForUser(userId);
  const brands = await institutionBrands(cards);

  const rows = cards.map((c) => ({ c, v: viewForCard(c, today) }));
  const owed = cards.reduce((s, c) => s + Math.max(0, c.currentBalance), 0);
  const limit = cards.reduce((s, c) => s + (c.creditLimit ?? 0), 0);
  const dueSoon = rows.filter((r) => r.v.state === "dueSoon" || r.v.state === "overdue");

  return (
    <main className="tn-main">
      <NewSubNav section="everything" />

      {cards.length === 0 ? (
        <div className="tn-card tn-empty">
          <p style={{ margin: "0 0 16px" }}>No credit cards connected yet.</p>
          <PlaidButton mode="create" label="Connect a card" mock={MOCK_MODE} />
        </div>
      ) : (
        <>
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tn-muted">On your cards right now</span>
            <span className="tn-disp money" style={{ fontSize: "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 1 }}>
              {dollars(owed)}
            </span>
            <span style={{ fontSize: 17, color: "var(--tn-ink-3)" }}>
              {limit > 0 ? `${Math.round((owed / limit) * 100)}% of your ${dollars(limit)} in limits. ` : ""}
              {dueSoon.length ? `${dueSoon.length} payment${dueSoon.length === 1 ? "" : "s"} due soon.` : "Nothing due in the next few days."}
            </span>
          </section>

          <section className="tn-section" style={{ gap: 12 }}>
            {rows.map(({ c, v }) => {
              const brand = c.institutionId ? brands[c.institutionId] : undefined;
              const tone = v.state === "overdue" ? "var(--tn-coral)" : v.state === "dueSoon" ? "var(--tn-amber)" : v.state === "paid" ? "var(--tn-lime)" : "var(--tn-ink-3)";
              const sentence =
                v.credit
                  ? "You're in credit on this card. Nothing to pay."
                  : v.state === "paid"
                    ? "This statement is paid in full."
                    : v.state === "noStatement"
                      ? "No statement yet."
                      : v.left != null && v.left > 0
                        ? `Pay ${dollars(v.left)}${c.liability?.nextPaymentDueDate ? ` by ${shortDate(c.liability.nextPaymentDueDate)}` : ""} to clear the statement${v.amountDue != null && !v.minimumMet ? ` (minimum ${dollars(v.amountDue)})` : ""}.`
                        : v.dueLabel ?? "";
              const use = v.utilization != null ? Math.min(100, Math.round(v.utilization * 100)) : null;
              return (
                <div key={c.accountId} className="tn-card" style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", gap: "6px 18px", alignItems: "center", padding: "18px 22px" }}>
                  <span className="tn-avatar" style={{ width: 48, height: 48, background: brand?.color ?? undefined }} aria-hidden="true">
                    {brand?.logo ? <img src={brand.logo} alt="" /> : (c.institutionName ?? c.name).charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tn-row-title" style={{ fontSize: 16 }}>
                      {accountDisplayName(c.name, c.nickname)}
                      {c.mask ? <span className="tn-faint" style={{ fontWeight: 400 }}> •• {c.mask}</span> : null}
                    </div>
                    <div style={{ fontSize: 14, color: tone }}>{sentence}</div>
                    {v.dueLabel && v.state !== "paid" && <div className="tn-faint" style={{ fontSize: 13 }}>{v.dueLabel}</div>}
                  </div>
                  <span className="tn-disp money" style={{ fontSize: 24, fontWeight: 700, textAlign: "right" }}>
                    {dollars(Math.max(0, c.currentBalance))}
                    {c.currency !== NET_WORTH_CURRENCY ? ` ${c.currency}` : ""}
                  </span>
                  {use != null && (
                    <div style={{ gridColumn: "2 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="tn-bar" style={{ flex: 1, height: 8 }} aria-hidden="true">
                        <b style={{ width: `${use}%`, background: v.utilizationTone === "healthy" ? "var(--tn-ink)" : v.utilizationTone === "high" ? "var(--tn-amber)" : "var(--tn-coral)" }} />
                      </div>
                      <span className="tn-faint" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {use}% of <span className="money">{dollars(c.creditLimit!)}</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          <p className="tn-faint" style={{ margin: 0, fontSize: 13 }}>
            Keeping each card under 30% of its limit is kinder to your credit score. Payments you make show up here within a day.
          </p>
        </>
      )}
    </main>
  );
}
