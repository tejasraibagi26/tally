import { asc, eq, isNull, or } from "drizzle-orm";
import { Wand2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleRow } from "@/components/rules/RuleRow";
import { RULE_COLUMNS } from "@/components/rules/ruleColumns";
import { summarizeMatch, summarizeActions } from "@/lib/ruleSummary";
import { groupCategoryOptions } from "@/lib/categoryOptions";
import type { RuleActions, RuleMatch } from "@tally/core/rulesEngine";
import { accountDisplayName } from "@tally/core/accountName";

const PAGE_SIZE = 25;

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;

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

  // Rules are few enough to read in one query (the header counts them all);
  // the page is sliced here rather than in SQL to keep it one round trip.
  const total = rules.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const pageRules = rules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const pageHref = (p: number) => (p > 1 ? `/rules?page=${p}` : "/rules");

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 h-full min-h-0 flex flex-col gap-6">
      <PageHeader
        title="Rules"
        meta={[
          `${total} rule${total === 1 ? "" : "s"}`,
          total > 0 && `${rules.filter((r) => r.enabled).length} enabled`,
        ]}
        actions={
          <RuleForm
            categories={groupedCategories}
            accounts={accounts.map((a) => ({ id: a.id, name: `${accountDisplayName(a.name, a.nickname)} ····${a.mask ?? "----"}` }))}
          />
        }
      />

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-none">
          <CardHeader title="Existing rules" meta="Lower priority number runs first" />
        </div>
        {total === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-10">
            <EmptyState
              icon={Wand2}
              animation="wiggle"
              title="No rules yet"
              description={'Use New rule, or click "Always categorize this way" on any transaction to add one automatically.'}
            />
          </div>
        ) : (
          <>
            <div className={`${RULE_COLUMNS} py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 flex-none`}>
              <span>Priority</span>
              <span>Rule</span>
              <span>Enabled</span>
              <span />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {pageRules.map((r) => (
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
              ))}
            </div>

            <Pager page={page} totalPages={totalPages} start={start} end={end} total={total} hrefFor={pageHref} />
          </>
        )}
      </Card>
    </div>
  );
}
