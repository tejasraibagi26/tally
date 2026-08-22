import { asc, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleRow } from "@/components/rules/RuleRow";
import { summarizeMatch, summarizeActions } from "@/lib/ruleSummary";
import type { RuleActions, RuleMatch } from "@/lib/rulesEngine";

export default async function RulesPage() {
  const userId = await requireUserId();

  const [rules, categories, accounts] = await Promise.all([
    db.select().from(schema.rules).where(eq(schema.rules.userId, userId)).orderBy(asc(schema.rules.priority)),
    db.query.categories.findMany({
      where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
      orderBy: (c, { asc: ascOrder }) => [ascOrder(c.name)],
    }),
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-text">Rules</h1>
        <span className="text-[13.5px] text-text-3">{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
      </div>

      <Card>
        <CardHeader title="New rule" />
        <RuleForm
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          accounts={accounts.map((a) => ({ id: a.id, name: `${a.name} ····${a.mask ?? "----"}` }))}
        />
      </Card>

      <Card>
        <CardHeader title="Existing rules" meta="Lower priority number runs first" />
        {rules.length === 0 ? (
          <div className="px-4 py-10 text-center text-text-2 text-[15px]">
            No rules yet. Rules created from "Always categorize this way" on a transaction show up here too.
          </div>
        ) : (
          rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={{
                id: r.id,
                priority: r.priority,
                enabled: r.enabled,
                matchSummary: summarizeMatch(r.match as RuleMatch, { accountName: (id) => accountNameById.get(id) }),
                actionsSummary: summarizeActions(r.actions as RuleActions, (id) => categoryNameById.get(id)),
              }}
            />
          ))
        )}
      </Card>
    </div>
  );
}
