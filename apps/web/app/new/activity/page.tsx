import Link from "next/link";
import { and, desc, eq, gte, ilike, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { listUserCategories } from "@/lib/userCategories";
import { monthTotals } from "@/lib/analytics";
import { getBudgetsForMonth } from "@/lib/budgets";
import { accountDisplayName } from "@tally/core/accountName";
import { monthRange } from "@tally/core/budgetMath";
import { daysBefore } from "@tally/core/overviewView";
import { todayInZone } from "@tally/core/zonedDate";
import { formatCents } from "@tally/core/money";
import { dayLabel, dollars } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { TxPanel } from "@/components/new/TxPanel";

type Search = { q?: string; account?: string; review?: string; t?: string };

function href(sp: Search, patch: Partial<Search>): string {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return `/new/activity${qs ? `?${qs}` : ""}`;
}

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const month = `${today.slice(0, 7)}-01`;
  const { end: monthEnd } = monthRange(month);
  const q = sp.q?.trim() ?? "";
  const reviewOnly = sp.review === "1";

  // Searching reaches back a year; otherwise it's this month.
  const where: SQL[] = [eq(schema.transactions.userId, userId), lt(schema.transactions.postedDate, monthEnd), gte(schema.transactions.postedDate, q ? daysBefore(today, 365) : month)];
  if (q) where.push(or(ilike(schema.transactions.merchantName, `%${q}%`), ilike(schema.transactions.name, `%${q}%`))!);
  if (sp.account) where.push(eq(schema.transactions.accountId, sp.account));
  if (reviewOnly) where.push(eq(schema.transactions.reviewed, false), eq(schema.transactions.isTransfer, false));

  const [rows, categories, accountRows, totals, [unreviewed], usage] = await Promise.all([
    db
      .select({
        id: schema.transactions.id,
        date: schema.transactions.postedDate,
        amount: schema.transactions.amount,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        logoUrl: schema.transactions.logoUrl,
        categoryId: schema.transactions.categoryId,
        accountId: schema.transactions.accountId,
        isPending: schema.transactions.isPending,
        isTransfer: schema.transactions.isTransfer,
        reviewed: schema.transactions.reviewed,
        excluded: schema.transactions.excludedFromBudget,
      })
      .from(schema.transactions)
      .where(and(...where))
      .orderBy(desc(schema.transactions.postedDate), desc(schema.transactions.createdAt))
      .limit(300),
    listUserCategories(userId),
    db.select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname }).from(schema.accounts).where(eq(schema.accounts.userId, userId)),
    monthTotals(userId, month),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.reviewed, false), eq(schema.transactions.isTransfer, false), gte(schema.transactions.postedDate, month), lt(schema.transactions.postedDate, monthEnd))),
    // The categories this user actually uses, for the quick picks.
    db
      .select({ categoryId: schema.transactions.categoryId, n: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.categoryId), gte(schema.transactions.postedDate, daysBefore(today, 180))))
      .groupBy(schema.transactions.categoryId)
      .orderBy(desc(sql`count(*)`))
      .limit(12),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const acctById = new Map(accountRows.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));
  const label = (r: (typeof rows)[number]) => r.merchantName ?? r.name;

  // Group by day, newest first, with each day's money out and in.
  const days: { date: string; out: number; in: number; rows: typeof rows }[] = [];
  for (const r of rows) {
    let d = days.at(-1);
    if (!d || d.date !== r.date) days.push((d = { date: r.date, out: 0, in: 0, rows: [] }));
    d.rows.push(r);
    if (!r.isTransfer && !r.excluded) {
      if (r.amount < 0) d.out += -r.amount;
      else d.in += r.amount;
    }
  }

  const selected = sp.t ? (rows.find((r) => r.id === sp.t) ?? null) : null;
  let selectedExtras: { trips: number; avg: number; budget: { spend: number; available: number; name: string } | null; quick: { id: string; name: string }[] } | null = null;
  if (selected) {
    const key = selected.merchantName ?? selected.name;
    const [[stats], budgets] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(abs(${schema.transactions.amount})), 0)::int` })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            gte(schema.transactions.postedDate, daysBefore(today, 365)),
            selected.merchantName ? eq(schema.transactions.merchantName, key) : eq(schema.transactions.name, key),
          ),
        ),
      getBudgetsForMonth(userId, month),
    ]);
    const line = selected.categoryId ? budgets.find((b) => b.categoryId === selected.categoryId) : undefined;
    const kind = selected.amount > 0 ? "income" : "expense";
    const quick = usage
      .map((u) => catById.get(u.categoryId!))
      .filter((c): c is NonNullable<typeof c> => !!c && c.kind === kind)
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name }));
    selectedExtras = {
      trips: stats?.n ?? 0,
      avg: stats?.avg ?? 0,
      budget: line ? { spend: line.spend, available: line.amount + line.rolloverFromPrior, name: line.categoryName } : null,
      quick,
    };
  }
  const pickable = categories.filter((c) => c.kind === "expense" || c.kind === "income").map((c) => ({ id: c.id, name: c.name }));

  return (
    <main className="tn-main" style={{ gap: 26 }}>
      <NewSubNav section="everything" />

      <section className="tn-section-head" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="tn-muted">{new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} so far</span>
          <span className="tn-disp" style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 700, lineHeight: 1.05 }}>
            <span className="money">{dollars(totals.spend)}</span> out · <span className="tn-lime money">{dollars(totals.income)}</span> in
          </span>
        </div>
        <Link href="/transactions" className="tn-btn">
          Add one by hand (classic)
        </Link>
      </section>

      <form action="/new/activity" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <label className="tn-input" style={{ flex: "1 1 360px", display: "flex", alignItems: "center", gap: 10, borderRadius: 999, minHeight: 52, background: "var(--tn-surface)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a19f95" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search</span>
          <input name="q" defaultValue={q} placeholder="Search a merchant, like costco" style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: "inherit", font: "inherit", fontSize: 16 }} />
        </label>
        <label style={{ display: "flex" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Account</span>
          <select name="account" defaultValue={sp.account ?? ""} className="tn-chip" style={{ minHeight: 52 }}>
            <option value="">All accounts</option>
            {accountRows.map((a) => (
              <option key={a.id} value={a.id}>
                {accountDisplayName(a.name, a.nickname)}
              </option>
            ))}
          </select>
        </label>
        {reviewOnly && <input type="hidden" name="review" value="1" />}
        <button type="submit" className="tn-btn" style={{ minHeight: 52 }}>
          Search
        </button>
        {(q || sp.account || reviewOnly) && (
          <Link href="/new/activity" className="tn-btn" style={{ minHeight: 52 }}>
            Clear
          </Link>
        )}
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
        <section style={{ flex: "999 1 520px", minWidth: 0 }} aria-label="Transactions">
          {(unreviewed?.count ?? 0) > 0 && !reviewOnly && (
            <div className="tn-banner" style={{ background: "var(--tn-amber-wash)" }}>
              <i className="tn-dot" style={{ background: "var(--tn-amber)" }} />
              <span style={{ flex: "1 1 260px", color: "#f2e3c2" }}>
                {unreviewed!.count} transaction{unreviewed!.count === 1 ? "" : "s"} need a quick look. Tally filed {unreviewed!.count === 1 ? "it" : "them"} on its own.
              </span>
              <Link href={href({}, { review: "1" })} className="tn-btn tn-btn-sm" style={{ background: "var(--tn-amber)", borderColor: "var(--tn-amber)", color: "var(--tn-bg)" }}>
                Review {unreviewed!.count}
              </Link>
            </div>
          )}
          {reviewOnly && <h2 className="tn-h2" style={{ margin: "4px 6px" }}>To review</h2>}

          {days.length === 0 && <div className="tn-empty">{q ? `Nothing matches “${q}” in the past year.` : "Nothing here yet."}</div>}

          {days.map((d) => (
            <div key={d.date}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "22px 6px 8px", fontSize: 14 }}>
                <b style={{ fontWeight: 600 }}>{d.date === today ? `Today · ${dayLabel(d.date)}` : dayLabel(d.date)}</b>
                <span className="tn-muted">
                  {d.out > 0 && <span className="money">{dollars(d.out)} out</span>}
                  {d.out > 0 && d.in > 0 && " · "}
                  {d.in > 0 && <span className="money">{dollars(d.in)} in</span>}
                </span>
              </div>
              {d.rows.map((r) => {
                const cat = r.categoryId ? catById.get(r.categoryId) : undefined;
                const tag = r.isTransfer ? "Transfer" : (cat?.name ?? "Not sure yet");
                const unsure = !r.isTransfer && (!cat || !r.reviewed);
                return (
                  <Link key={r.id} href={href(sp, { t: r.id })} scroll={false} className="tn-row" aria-current={r.id === sp.t ? "true" : undefined}>
                    <span className="tn-avatar" aria-hidden="true">
                      {r.logoUrl ? <img src={r.logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : label(r).trim().charAt(0).toUpperCase()}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span className="tn-row-title">
                        {label(r)}
                        {r.isPending && <span className="tn-faint" style={{ fontSize: 12, marginLeft: 8, fontWeight: 400 }}>pending</span>}
                      </span>
                      <span className="tn-row-sub">
                        <span className="tn-tag" style={unsure ? { color: "var(--tn-amber)" } : undefined}>
                          {tag}
                        </span>
                        {acctById.get(r.accountId) ?? ""}
                      </span>
                    </span>
                    <span className="tn-amt money" style={{ color: r.amount > 0 ? "var(--tn-lime)" : "var(--tn-ink)", opacity: r.excluded ? 0.5 : 1 }}>
                      {r.amount > 0 ? "+" : ""}
                      {formatCents(Math.abs(r.amount))}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
          {rows.length === 300 && <p className="tn-faint" style={{ padding: "16px 6px" }}>Showing the latest 300. Search to narrow it down.</p>}
        </section>

        <aside aria-label="Selected transaction" className="tn-card" style={{ flex: "1 1 360px", maxWidth: 460, display: "flex", flexDirection: "column", gap: 18, padding: 26, borderRadius: 24, position: "sticky", top: 16 }}>
          {!selected || !selectedExtras ? (
            <p className="tn-muted" style={{ margin: 0 }}>
              Pick a transaction to see what it means for your month, fix its category, or teach Tally where it goes.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="tn-avatar" style={{ width: 56, height: 56, borderRadius: 18, fontSize: 20 }} aria-hidden="true">
                  {selected.logoUrl ? <img src={selected.logoUrl} alt="" referrerPolicy="no-referrer" /> : label(selected).trim().charAt(0).toUpperCase()}
                </span>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span className="tn-disp" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {label(selected)}
                  </span>
                  <span className="tn-muted" style={{ fontSize: 13 }}>
                    {dayLabel(selected.date)} · {acctById.get(selected.accountId) ?? ""}
                    {selected.isPending ? " · pending" : ""}
                  </span>
                </div>
              </div>
              <span className="tn-disp money" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: selected.amount > 0 ? "var(--tn-lime)" : "var(--tn-ink)" }}>
                {selected.amount > 0 ? "+" : ""}
                {formatCents(Math.abs(selected.amount))}
              </span>

              {selected.isTransfer ? (
                <p style={{ margin: 0, color: "var(--tn-ink-3)" }}>This is money moving between your own accounts, so it isn&apos;t counted as spending or income.</p>
              ) : (
                <>
                  {selectedExtras.budget && (
                    <p style={{ margin: 0, padding: "14px 16px", borderRadius: 14, background: "var(--tn-bg)", color: "var(--tn-ink-2)" }}>
                      This counts toward <strong style={{ color: "var(--tn-ink)" }}>{selectedExtras.budget.name}</strong>: <span className="money">{dollars(selectedExtras.budget.spend)}</span> of{" "}
                      <span className="money">{dollars(selectedExtras.budget.available)}</span> used
                      {selectedExtras.budget.spend > selectedExtras.budget.available ? ", over for the month." : `, ${dollars(selectedExtras.budget.available - selectedExtras.budget.spend)} left.`}
                    </p>
                  )}
                  <TxPanel
                    key={selected.id}
                    id={selected.id}
                    merchant={label(selected)}
                    categoryId={selected.categoryId}
                    quick={selectedExtras.quick}
                    all={pickable}
                    reviewed={selected.reviewed}
                    excluded={selected.excluded}
                  />
                </>
              )}

              {selectedExtras.trips > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid var(--tn-line)", fontSize: 14 }}>
                  <span className="tn-muted">Past year here</span>
                  <span>
                    {selectedExtras.trips} times, about <span className="money">{dollars(selectedExtras.avg)}</span> each
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid var(--tn-line)", fontSize: 14 }}>
                <span className="tn-muted">On your statement</span>
                <span className="tn-faint" style={{ fontSize: 12, textAlign: "right" }}>
                  {selected.name}
                </span>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
