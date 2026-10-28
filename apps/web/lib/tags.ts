import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { summarizeTag, type TagSummary } from "@tally/core/tagView";

export interface TagListItem {
  tag: string;
  count: number;
  /** Net spend, transfers aside (positive = money out). */
  spend: number;
  firstDate: string;
  lastDate: string;
}

/** Every tag the user has used, most recently used first. */
export async function tagsFor(userId: string): Promise<TagListItem[]> {
  const rows = await db.execute<{ tag: string; count: number; spend: string; first_date: string; last_date: string }>(sql`
    select t.tag,
           count(*)::int as count,
           coalesce(sum(case when c.kind is distinct from 'income' then -tx.amount else 0 end), 0)::bigint as spend,
           min(tx.posted_date)::text as first_date,
           max(tx.posted_date)::text as last_date
    from ${schema.transactions} tx
    cross join lateral jsonb_array_elements_text(tx.tags) as t(tag)
    left join ${schema.categories} c on c.id = tx.category_id
    where tx.user_id = ${userId} and tx.is_transfer = false
    group by t.tag
    order by max(tx.posted_date) desc, t.tag
  `);
  return [...rows].map((r) => ({ tag: r.tag, count: r.count, spend: Number(r.spend), firstDate: r.first_date, lastDate: r.last_date }));
}

/** One tag summed across categories (@tally/core/tagView). */
export async function tagSummaryFor(userId: string, tag: string): Promise<TagSummary> {
  const rows = await db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.postedDate,
      amount: schema.transactions.amount,
      isTransfer: schema.transactions.isTransfer,
      categoryId: schema.transactions.categoryId,
      categoryName: schema.categories.name,
      colorSlot: schema.categories.colorSlot,
      categoryKind: schema.categories.kind,
    })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(and(eq(schema.transactions.userId, userId), sql`${schema.transactions.tags} @> ${JSON.stringify([tag])}::jsonb`));
  return summarizeTag(tag, rows);
}
