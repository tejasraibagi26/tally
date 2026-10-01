import { asc, eq, isNull, or } from "drizzle-orm";
import { Wand2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleRow } from "@/components/rules/RuleRow";
import { summarizeMatch, summarizeActions } from "@/lib/ruleSummary";
import { groupCategoryOptions } from "@/lib/categoryOptions";
import type { RuleActions, RuleMatch } from "@tally/core/rulesEngine";
import { accountDisplayName } from "@tally/core/accountName";

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
  const accountNameById = new Map(accounts.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));
  const groupedCategories = groupCategoryOptions(categories);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Rules"
        meta={[
          `${rules.length} rule${rules.length === 1 ? "" : "s"}`,
          rules.length > 0 && `${rules.filter((r) => r.enabled).length} enabled`,
        ]}
        actions={
          <RuleForm
            categories={groupedCategories}
            accounts={accounts.map((a) => ({ id: a.id, name: `${accountDisplayName(a.name, a.nickname)} ····${a.mask ?? "----"}` }))}
          />
        }
      />

      <Card>
        <CardHeader title="Existing rules" meta="Lower priority number runs first" />
        {rules.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={Wand2}
              animation="wiggle"
              title="No rules yet"
              description={'Use New rule, or click "Always categorize this way" on any transaction to add one automatically.'}
            />
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
