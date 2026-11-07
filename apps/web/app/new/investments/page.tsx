import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { latestHoldingsForUser, portfolioHistory } from "@/lib/portfolio";
import { todayInZone } from "@tally/core/zonedDate";
import { allocationBy, rollUpPositions, summarizeRange, unrealizedGainTotal } from "@tally/core/investments";
import { formatSecurityType } from "@tally/core/portfolioMath";
import { dollars, signedDollars } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { NetWorthTrend } from "@/components/new/NetWorthTrend";
import { PlaidButton } from "@/components/new/PlaidButton";
import { MOCK_MODE } from "@/lib/config";

const SLICE = ["#c9f26b", "#9fc7ff", "#f2b84b", "#e8b4ff", "#ff9c8c", "#7ddccd", "#d9d8cf"];

export default async function NewInvestmentsPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const [holdings, history] = await Promise.all([latestHoldingsForUser(userId), portfolioHistory(userId)]);

  if (holdings.length === 0) {
    return (
      <main className="tn-main">
        <NewSubNav section="everything" />
        <div className="tn-card tn-empty">
          <p style={{ margin: "0 0 16px" }}>Connect a brokerage like Wealthsimple or Questrade to see your TFSA, RRSP and FHSA in one place.</p>
          <PlaidButton mode="create" label="Connect a brokerage" mock={MOCK_MODE} />
        </div>
      </main>
    );
  }

  const positions = rollUpPositions(holdings);
  const value = positions.reduce((s, p) => s + p.value, 0);
  const gain = unrealizedGainTotal(positions);
  const year = summarizeRange(history, "1Y", today);
  const byType = allocationBy(holdings, "type");
  const byAccount = allocationBy(holdings, "account");

  return (
    <main className="tn-main">
      <NewSubNav section="everything" />

      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="tn-muted">Invested</span>
          <span className="tn-disp money" style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 700, lineHeight: 1 }}>
            {dollars(value)}
          </span>
          <span style={{ fontSize: 17, color: "var(--tn-ink-3)" }}>
            {year.covered && year.points.length > 1 ? (
              <>
                Over the past year you added <span className="money">{dollars(year.added)}</span> and the markets{" "}
                <span className={`money ${year.growth >= 0 ? "tn-lime" : "tn-coral"}`}>{year.growth >= 0 ? `added ${dollars(year.growth)}` : `took ${dollars(-year.growth)}`}</span>.
              </>
            ) : gain.covered > 0 ? (
              <>
                Up <span className={`money ${gain.amount >= 0 ? "tn-lime" : "tn-coral"}`}>{signedDollars(gain.amount)}</span> on what you paid.
              </>
            ) : (
              "Growth shows once Tally has a few weeks of history."
            )}
          </span>
        </div>
        {history.length > 1 && <NetWorthTrend points={history.map((p) => ({ asOfDate: p.date, net: p.value }))} goal={null} />}
      </section>

      <div className="tn-grid-2" style={{ gap: 24 }}>
        {[
          { title: "By kind", slices: byType },
          { title: "By account", slices: byAccount },
        ].map((g) => (
          <section key={g.title} className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="tn-h2" style={{ fontSize: 18 }}>
              {g.title}
            </h2>
            <div style={{ display: "flex", gap: 3, height: 14 }} role="img" aria-label={g.slices.map((s) => `${s.label} ${Math.round(s.pct * 100)}%`).join(", ")}>
              {g.slices.map((s, i) => (
                <i key={s.label} style={{ width: `${s.pct * 100}%`, minWidth: 4, borderRadius: 4, background: SLICE[i % SLICE.length] }} />
              ))}
            </div>
            {g.slices.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: SLICE[i % SLICE.length], flex: "none" }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title === "By kind" ? formatSecurityType(s.label) : s.label}</span>
                <span className="tn-muted">{Math.round(s.pct * 100)}%</span>
                <span className="money" style={{ minWidth: 80, textAlign: "right" }}>
                  {dollars(s.value)}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>

      <section className="tn-section" style={{ gap: 4 }}>
        <h2 className="tn-h2">What you hold</h2>
        {positions.map((p) => (
          <div key={p.securityId} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto", gap: "4px 14px", alignItems: "center", padding: "12px 4px", borderTop: "1px solid var(--tn-line)" }}>
            <span className="tn-avatar" style={{ fontSize: 12 }} aria-hidden="true">
              {(p.ticker ?? p.securityName ?? "?").slice(0, 4)}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="tn-row-title" style={{ display: "block" }}>
                {p.securityName ?? p.ticker ?? "Holding"}
              </span>
              <span className="tn-row-sub" style={{ display: "block" }}>
                {[p.ticker, formatSecurityType(p.assetType), `${Math.round(p.weight * 100)}% of your portfolio`, p.lots.length > 1 ? `in ${p.lots.length} accounts` : p.lots[0]?.accountName].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="tn-amt money" style={{ display: "block" }}>
                {dollars(p.value)}
              </span>
              {p.gain && (
                <span className={`money ${p.gain.amount >= 0 ? "tn-lime" : "tn-coral"}`} style={{ fontSize: 13 }}>
                  {signedDollars(p.gain.amount)} ({(p.gain.pct * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
