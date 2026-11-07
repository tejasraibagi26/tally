import { requireUserId } from "@/lib/session";
import { MOCK_MODE } from "@/lib/config";
import { NET_WORTH_CURRENCY } from "@tally/core/fx";
import { composition, dollars, GROUP_LABEL, loadAccounts, type AccountGroup, type NewAccount } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { PlaidButton } from "@/components/new/PlaidButton";
import { BankActions, RenameAccount } from "@/components/new/AccountControls";

const ORDER: AccountGroup[] = ["cash", "savings", "invested", "card", "loan", "other"];
const DEBT = new Set<AccountGroup>(["card", "loan"]);

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function amountIn(a: NewAccount): string {
  return a.currency && a.currency !== NET_WORTH_CURRENCY ? `${dollars(a.balance)} ${a.currency}` : dollars(a.balance);
}

export default async function NewAccountsPage() {
  const userId = await requireUserId();
  const { accounts, items } = await loadAccounts(userId);
  const comp = composition(accounts);
  const net = comp.owned - comp.owed;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const problems = items.filter((i) => i.state.needsAttention || i.state.level === "blocked");

  const shares = [
    { label: "Cash", amount: comp.cash, color: "var(--tn-ink)" },
    { label: "Savings", amount: comp.savings + comp.other, color: "var(--tn-sky)" },
    { label: "Invested", amount: comp.invested, color: "var(--tn-lime)" },
  ].filter((s) => s.amount > 0);

  const biggest = [...shares].sort((a, b) => b.amount - a.amount)[0];
  const sentence =
    comp.owned > 0
      ? `${biggest ? `${pct(biggest.amount, comp.owned)}% of what you own is ${biggest.label === "Cash" ? "in everyday cash" : biggest.label === "Savings" ? "in savings" : "invested"}. ` : ""}${
          comp.owed > 0 ? `What you owe is ${pct(comp.owed, comp.owned)}% of what you own.` : "You don't owe anything."
        }`
      : "";

  return (
    <main className="tn-main">
      <NewSubNav section="everything" />

      <section className="tn-section" style={{ gap: 18 }}>
        <div className="tn-section-head" style={{ alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="tn-muted">
              {accounts.length} account{accounts.length === 1 ? "" : "s"}, worth together
            </span>
            <span className="tn-disp money" style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}>
              {dollars(net)}
            </span>
          </div>
          <PlaidButton mode="create" label="Connect an account" mock={MOCK_MODE} />
        </div>

        {comp.owned > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 4, height: 18 }} role="img" aria-label={shares.map((s) => `${s.label} ${pct(s.amount, comp.owned)}%`).join(", ")}>
              {shares.map((s) => (
                <i key={s.label} style={{ width: `${(s.amount / comp.owned) * 100}%`, minWidth: 6, borderRadius: 6, background: s.color }} />
              ))}
            </div>
            {comp.owed > 0 && (
              <div style={{ display: "flex", height: 8 }} role="img" aria-label={`Owed: ${pct(comp.owed, comp.owned)}% of what you own`}>
                <i style={{ width: `${Math.min(100, (comp.owed / comp.owned) * 100)}%`, minWidth: 6, borderRadius: 4, background: "var(--tn-coral)" }} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", fontSize: 14, color: "var(--tn-ink-3)" }}>
              {shares.map((s) => (
                <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                  {s.label} <span className="money">{dollars(s.amount)}</span>
                </span>
              ))}
              {comp.owed > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--tn-coral)" }} />
                  Owed <span className="money">{dollars(comp.owed)}</span>
                </span>
              )}
            </div>
            {sentence && <p style={{ margin: 0, fontSize: 17, color: "var(--tn-ink-2)", maxWidth: "64ch" }}>{sentence}</p>}
          </div>
        )}
      </section>

      {problems.map((p) => (
        <div key={p.id} className="tn-banner" style={{ background: "var(--tn-coral-wash)", boxShadow: "inset 0 0 0 1px #4a2a22" }}>
          <i className="tn-dot" style={{ background: "var(--tn-coral)" }} />
          <span style={{ flex: "1 1 320px" }}>
            <strong style={{ color: "#ff9c8c", fontWeight: 600 }}>{p.state.notice?.title ?? `${p.institution} needs you`}</strong>{" "}
            <span className="tn-muted">{p.state.notice?.body ?? p.state.statusLine}</span>
          </span>
          {p.state.action?.kind === "signIn" ? (
            <PlaidButton mode="update" itemId={p.id} label={p.state.action.label} tone="coral" />
          ) : (
            <BankActions id={p.id} name={p.institution} />
          )}
        </div>
      ))}

      {ORDER.map((g) => {
        const rows = accounts.filter((a) => a.group === g);
        if (rows.length === 0) return null;
        const total = rows.reduce((s, a) => s + a.converted, 0);
        return (
          <section key={g} className="tn-section" style={{ gap: 8 }}>
            <div className="tn-section-head" style={{ padding: "0 4px" }}>
              <h2 className="tn-h2">{GROUP_LABEL[g]}</h2>
              <span className="tn-disp money" style={{ fontSize: 18, fontWeight: 700 }}>
                {DEBT.has(g) ? "−" : ""}
                {dollars(total)}
              </span>
            </div>
            {rows.map((a) => {
              const item = a.itemId ? itemById.get(a.itemId) : undefined;
              const dim = item?.state.dimBalances;
              const use = g === "card" && a.creditLimit ? Math.min(100, Math.round((a.balance / a.creditLimit) * 100)) : null;
              return (
                <div key={a.id} className="tn-card" style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", gap: "4px 18px", alignItems: "center", padding: "16px 20px" }}>
                  <span className="tn-avatar" style={{ width: 48, height: 48 }} aria-hidden="true">
                    {(a.institution ?? a.name).trim().charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tn-row-title" style={{ fontSize: 16 }}>
                      {a.name}
                    </div>
                    <div className="tn-row-sub" style={item?.state.needsAttention ? { color: "#ff9c8c" } : undefined}>
                      {[a.isManual ? "Added by you" : a.institution, a.mask && `•• ${a.mask}`, item?.state.statusLine].filter(Boolean).join(" · ")}
                    </div>
                    {!a.isManual && <div style={{ marginTop: 8 }}><RenameAccount id={a.id} name={a.name} /></div>}
                    {use != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, maxWidth: 320 }}>
                        <div className="tn-bar" style={{ flex: 1, height: 8 }} aria-hidden="true">
                          <b style={{ width: `${use}%`, background: use >= 70 ? "var(--tn-amber)" : "var(--tn-ink)" }} />
                        </div>
                        <span className="tn-faint" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {use}% of <span className="money">{dollars(a.creditLimit!)}</span> limit
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="tn-disp money" style={{ fontSize: 24, fontWeight: 700, textAlign: "right", opacity: dim ? 0.55 : 1 }}>
                    {DEBT.has(g) && a.balance > 0 ? "−" : ""}
                    {amountIn(a)}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}

      {items.length > 0 && (
        <section className="tn-section" style={{ gap: 0 }}>
          <h2 className="tn-h2" style={{ marginBottom: 8 }}>
            Your banks
          </h2>
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", padding: "14px 0", borderTop: "1px solid var(--tn-line)" }}>
              <span style={{ flex: "1 1 240px", minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 500 }}>{i.institution}</span>
                <span className="tn-muted" style={{ fontSize: 13, color: i.state.needsAttention ? "#ff9c8c" : undefined }}>
                  {i.state.statusLine}
                </span>
              </span>
              <PlaidButton mode="update" itemId={i.id} label="Add or remove accounts" tone="ghost" />
              <BankActions id={i.id} name={i.institution} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
