import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { seedMockLiabilitiesForItem } from "@/lib/mock/seedLiabilities";
import { recordSyncRun } from "@/lib/syncRuns";
import type { SyncTrigger } from "@/lib/plaidSync";

// §6.5: v1 only tracks credit-card liabilities (the schema has no
// mortgage/student-loan tables) — student/mortgage liabilities in the
// response, if any, are ignored.
const NOT_SUPPORTED_CODES = new Set(["NO_LIABILITY_ACCOUNTS", "PRODUCTS_NOT_SUPPORTED", "PRODUCT_NOT_ENABLED"]);

export async function syncLiabilitiesForItem(itemId: string, trigger: SyncTrigger): Promise<void> {
  const startedAt = new Date();
  const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.id, itemId)).limit(1);
  if (!item) return;

  try {
    if (isMockPlaidItemId(item.plaidItemId)) {
      await seedMockLiabilitiesForItem(itemId);
      await recordSyncRun(itemId, "liabilities", trigger, startedAt, {});
      return;
    }

    const accessToken = await getAccessToken(itemId);
    const res = await plaidClient.liabilitiesGet({ access_token: accessToken });
    const creditLiabilities = res.data.liabilities.credit ?? [];
    if (creditLiabilities.length === 0) {
      await recordSyncRun(itemId, "liabilities", trigger, startedAt, {});
      return;
    }

    const plaidAccountIds = creditLiabilities.map((c) => c.account_id).filter((id): id is string => id != null);
    const acctRows = await db
      .select({ id: schema.accounts.id, plaidAccountId: schema.accounts.plaidAccountId })
      .from(schema.accounts)
      .where(inArray(schema.accounts.plaidAccountId, plaidAccountIds));
    const acctIdByPlaidId = new Map(acctRows.map((r) => [r.plaidAccountId!, r.id]));

    const now = new Date();
    for (const c of creditLiabilities) {
      const accountId = c.account_id ? acctIdByPlaidId.get(c.account_id) : undefined;
      if (!accountId) continue;

      const values = {
        accountId,
        aprs: c.aprs,
        isOverdue: c.is_overdue ?? false,
        lastPaymentAmount: c.last_payment_amount != null ? Math.round(c.last_payment_amount * 100) : null,
        lastPaymentDate: c.last_payment_date,
        lastStatementBalance: c.last_statement_balance != null ? Math.round(c.last_statement_balance * 100) : null,
        lastStatementIssueDate: c.last_statement_issue_date,
        minimumPaymentAmount: c.minimum_payment_amount != null ? Math.round(c.minimum_payment_amount * 100) : null,
        nextPaymentDueDate: c.next_payment_due_date,
        asOf: now,
      };

      await db.insert(schema.liabilitiesCredit).values(values).onConflictDoUpdate({ target: schema.liabilitiesCredit.accountId, set: values });
    }

    await recordSyncRun(itemId, "liabilities", trigger, startedAt, { added: creditLiabilities.length });
  } catch (err) {
    const code = plaidErrorCode(err);
    if (code && NOT_SUPPORTED_CODES.has(code)) return; // not a failure — no liability-eligible accounts on this item
    console.error(`Liabilities sync failed for item ${itemId}`, err);
    await recordSyncRun(itemId, "liabilities", trigger, startedAt, { error: err instanceof Error ? err.message : "unknown error" });
    throw err; // rethrow so the queue worker retries (§8.2)
  }
}
