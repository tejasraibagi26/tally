import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { listUserCategories } from "@/lib/userCategories";
import { summarizeActions, summarizeMatch } from "@/lib/ruleSummary";
import { accountDisplayName } from "@tally/core/accountName";
import type { RuleActions, RuleMatch } from "@tally/core/rulesEngine";
import { NewSubNav } from "@/components/new/NewNav";
import { NewRule, RuleRow } from "@/components/new/RuleControls";

export default async function NewRulesPage() {
  const userId = await requireUserId();
  const [rules, categories, accounts] = await Promise.all([
    db.select().from(schema.rules).where(eq(schema.rules.userId, userId)).orderBy(asc(schema.rules.priority), asc(schema.rules.createdAt)),
    listUserCategories(userId),
    db.select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname }).from(schema.accounts).where(eq(schema.accounts.userId, userId)),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const acctName = new Map(accounts.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));

  const sentence = (match: RuleMatch, actions: RuleActions) => {
    const s = `When ${summarizeMatch(match, { accountName: (id) => acctName.get(id) })}, ${summarizeActions(actions, (id) => catName.get(id))}.`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <main className="tn-main" style={{ maxWidth: 860 }}>
      <NewSubNav section="settings" />

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="tn-disp" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 40px)", fontWeight: 700 }}>
          Rules
        </h1>
        <p style={{ margin: 0, color: "var(--tn-ink-3)", maxWidth: "60ch" }}>
          Rules file new transactions for you as they arrive, so you only fix a merchant once. Saying &quot;Yes, always&quot; in Activity makes one too. Rules near the top win.
        </p>
      </section>

      <NewRule categories={categories.filter((c) => c.kind === "expense" || c.kind === "income").map((c) => ({ id: c.id, name: c.name }))} />

      <section>
        {rules.length === 0 ? (
          <p className="tn-muted">No rules yet.</p>
        ) : (
          rules.map((r) => <RuleRow key={r.id} id={r.id} enabled={r.enabled} sentence={sentence(r.match as RuleMatch, r.actions as RuleActions)} />)
        )}
      </section>

      <p className="tn-faint" style={{ margin: 0, fontSize: 13 }}>
        Need amount ranges, splits or regex? Use the <Link href="/rules">advanced rule editor</Link>.
      </p>
    </main>
  );
}
