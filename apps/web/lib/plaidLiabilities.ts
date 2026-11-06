import { log } from "@switchyard/logger";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode, institutionSupportsProduct } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { seedMockLiabilitiesForItem } from "@/lib/mock/seedLiabilities";
import { recordSyncRun } from "@/lib/syncRuns";
import type { SyncTrigger } from "@/lib/plaidSync";

// Credit cards go to liabilities_credit; mortgages and student loans (the
// other two kinds /liabilities/get reports) go to liabilities_loan, keyed by
// the same loan account whose balance already counts against net worth.
// Other loans (auto, personal, lines of credit) have no Plaid detail.
const NOT_SUPPORTED_CODES = new Set(["NO_LIABILITY_ACCOUNTS", "PRODUCTS_NOT_SUPPORTED", "PRODUCT_NOT_ENABLED"]);

export async function syncLiabilitiesForItem(itemId: string, trigger: SyncTrigger): Promise<void> {
  const startedAt = new Date();
  const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.id, itemId)).limit(1);
  // Disconnected banks keep their last snapshot; there's no access to refresh it.
  if (!item || item.disconnectedAt) return;

  try {
    if (isMockPlaidItemId(item.plaidItemId)) {
      await seedMockLiabilitiesForItem(itemId);
      await recordSyncRun(itemId, "liabilities", trigger, startedAt, {});
      return;
    }

    // Skip the call entirely when the institution is known not to support
    // liabilities, rather than spend an API request every sync just to have
    // Plaid reject it with PRODUCTS_NOT_SUPPORTED (see institutionSupportsProduct).
    if (!(await institutionSupportsProduct(item.institutionId, "liabilities"))) return;

    const accessToken = await getAccessToken(itemId);
    const res = await plaidClient.liabilitiesGet({ access_token: accessToken });
    const creditLiabilities = res.data.liabilities.credit ?? [];
    const mortgages = res.data.liabilities.mortgage ?? [];
    const studentLoans = res.data.liabilities.student ?? [];
    if (creditLiabilities.length + mortgages.length + studentLoans.length === 0) {
      await recordSyncRun(itemId, "liabilities", trigger, startedAt, {});
      return;
    }

    const plaidAccountIds = [...creditLiabilities, ...mortgages, ...studentLoans].map((c) => c.account_id).filter((id): id is string => id != null);
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

    const loanRows: (typeof schema.liabilitiesLoan.$inferInsert)[] = [];
    for (const m of mortgages) {
      const accountId = m.account_id ? acctIdByPlaidId.get(m.account_id) : undefined;
      if (!accountId) continue;
      loanRows.push({
        accountId,
        kind: "mortgage",
        interestRate: rate(m.interest_rate?.percentage),
        nextPaymentDueDate: m.next_payment_due_date,
        nextPaymentAmount: cents(m.next_monthly_payment),
        lastPaymentAmount: cents(m.last_payment_amount),
        lastPaymentDate: m.last_payment_date,
        isOverdue: (m.past_due_amount ?? 0) > 0,
        pastDueAmount: cents(m.past_due_amount),
        originationPrincipal: cents(m.origination_principal_amount),
        originationDate: m.origination_date,
        payoffDate: m.maturity_date,
        asOf: now,
      });
    }
    for (const l of studentLoans) {
      const accountId = l.account_id ? acctIdByPlaidId.get(l.account_id) : undefined;
      if (!accountId) continue;
      loanRows.push({
        accountId,
        kind: "student",
        interestRate: rate(l.interest_rate_percentage),
        nextPaymentDueDate: l.next_payment_due_date,
        nextPaymentAmount: cents(l.minimum_payment_amount),
        lastPaymentAmount: cents(l.last_payment_amount),
        lastPaymentDate: l.last_payment_date,
        isOverdue: l.is_overdue ?? false,
        pastDueAmount: null,
        originationPrincipal: cents(l.origination_principal_amount),
        originationDate: l.origination_date,
        payoffDate: l.expected_payoff_date,
        asOf: now,
      });
    }
    for (const values of loanRows) {
      await db.insert(schema.liabilitiesLoan).values(values).onConflictDoUpdate({ target: schema.liabilitiesLoan.accountId, set: values });
    }

    await recordSyncRun(itemId, "liabilities", trigger, startedAt, { added: creditLiabilities.length + loanRows.length });
  } catch (err) {
    const code = plaidErrorCode(err);
    if (code && NOT_SUPPORTED_CODES.has(code)) return; // not a failure — no liability-eligible accounts on this item
    log.error(`Liabilities sync failed for item ${itemId} (${code ?? "unknown error"})`);
    await recordSyncRun(itemId, "liabilities", trigger, startedAt, { error: err instanceof Error ? err.message : "unknown error" });
    throw err; // rethrow so the queue worker retries (§8.2)
  }
}

/** Plaid's dollars to cents; null stays null (unknown is never $0). */
function cents(amount: number | null | undefined): number | null {
  return amount == null ? null : Math.round(amount * 100);
}

/** An interest rate as numeric's string, or null. */
function rate(percentage: number | null | undefined): string | null {
  return percentage == null ? null : String(percentage);
}
