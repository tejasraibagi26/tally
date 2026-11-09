import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { userCategories } from "@/lib/userCategories";
import { requireUserId } from "@/lib/session";
import { IncomeScheduleManager } from "@/components/settings/IncomeScheduleManager";
import { SettingsBlock, SettingsGroup } from "@/components/settings/SettingsLayout";
import { accountDisplayName } from "@tally/core/accountName";
import { SafeToSpendSettings } from "@/components/settings/SafeToSpendSettings";
import { paychequeFor, safeToSpendSettingsFor } from "@/lib/safeToSpend";
import { todayFor } from "@/lib/userTimezone";
import { CADENCE_LABEL } from "@tally/core/paycheque";
import { formatCents } from "@tally/core/money";
import { CalendarCheck } from "lucide-react";

// Settings → Income & safe to spend: the paycheque behind payday, income
// schedules, and which accounts count as spending money. /settings/income#safe-to-spend
// is where Overview's Safe to spend panel sends "Edit".
export default async function IncomeSettingsPage() {
  const userId = await requireUserId();
  const uc = userCategories(userId);
  const today = await todayFor(userId);

  const [accountRows, incomeCategories, incomeSchedules, safeSettings, paycheque] = await Promise.all([
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname, mask: schema.accounts.mask })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)),
    db
      .select({ id: uc.id, name: uc.name })
      .from(uc)
      .where(and(eq(uc.kind, "income"), or(isNull(uc.userId), eq(uc.userId, userId)))),
    db
      .select({
        id: schema.incomeSchedules.id,
        accountId: schema.incomeSchedules.accountId,
        categoryId: schema.incomeSchedules.categoryId,
        label: schema.incomeSchedules.label,
        amount: schema.incomeSchedules.amount,
        dayAnchors: schema.incomeSchedules.dayAnchors,
        active: schema.incomeSchedules.active,
        accountName: schema.accounts.name,
        accountNickname: schema.accounts.nickname,
        accountMask: schema.accounts.mask,
        categoryName: uc.name,
      })
      .from(schema.incomeSchedules)
      .leftJoin(schema.accounts, eq(schema.incomeSchedules.accountId, schema.accounts.id))
      .leftJoin(uc, eq(schema.incomeSchedules.categoryId, uc.id))
      .where(eq(schema.incomeSchedules.userId, userId)),
    safeToSpendSettingsFor(userId),
    paychequeFor(userId, today),
  ]);

  const accounts = accountRows.map((a) => ({ id: a.id, name: accountDisplayName(a.name, a.nickname), mask: a.mask }));
  const incomeSchedulesForDisplay = incomeSchedules.map(({ accountNickname, ...s }) => ({
    ...s,
    accountName: s.accountName != null ? accountDisplayName(s.accountName, accountNickname) : s.accountName,
  }));
  const paychequeAccount = paycheque ? accounts.find((a) => a.id === paycheque.accountId) : undefined;
  const labelOf = (a: { name: string; mask: string | null }) => a.name + (a.mask ? ` ····${a.mask}` : "");
  const paydayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <>
      <SettingsGroup
        id="income"
        title="Income"
        description="Tally finds your paycheque in your synced deposits. Add a schedule only for pay your bank doesn't sync reliably: set the amount and pay days once, and Tally adds it every payday."
      >
        <SettingsBlock className="flex items-start gap-3.5">
          <span className="ui-tile w-10 h-10 rounded-control bg-positive-subtle text-positive flex items-center justify-center flex-none">
            <CalendarCheck size={20} strokeWidth={2} aria-hidden="true" />
          </span>
          {paycheque?.confident ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-positive">Next paycheque</span>
              <span className="text-[16px] font-semibold text-text">
                {paydayLabel(paycheque.nextDate)} · about <span className="money money-fit"><span>{formatCents(Math.round(paycheque.amount / 100) * 100)}</span></span>
              </span>
              <span className="text-[13.5px] text-text-2">
                From {paycheque.label}
                {paychequeAccount ? ` into ${labelOf(paychequeAccount)}` : ""} · {CADENCE_LABEL[paycheque.cadence]} · the last 3 landed on time
              </span>
            </div>
          ) : paycheque ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-3">Next paycheque</span>
              <span className="text-[13.5px] text-text">Your pay from {paycheque.label} hasn&apos;t landed on a steady schedule lately.</span>
              <span className="text-[13.5px] text-text-2">Until it does, payday comes from your income schedule, or the end of the month.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-3">Next paycheque</span>
              <span className="text-[13.5px] text-text">No steady paycheque found yet.</span>
              <span className="text-[13.5px] text-text-2">Set your pay&apos;s category to Income and turn on &quot;Always use&quot;. After three paydays, Tally predicts the next one.</span>
            </div>
          )}
        </SettingsBlock>
        <SettingsBlock>
          <IncomeScheduleManager accounts={accounts} categories={incomeCategories} schedules={incomeSchedulesForDisplay} />
        </SettingsBlock>
      </SettingsGroup>

      <SafeToSpendSettings {...safeSettings} />
    </>
  );
}
