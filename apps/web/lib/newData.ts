import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { liveAccount, liveItem } from "@/lib/liveAccounts";
import { itemStatusToBadge } from "@/lib/freshness";
import { toNetWorthCurrency } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";
import { countsAsCash } from "@tally/core/safeToSpend";
import { connectionState, type ConnectionState } from "@tally/core/connectionState";
import { formatCents } from "@tally/core/money";
import type { Forecast } from "@tally/core/forecast";
import type { Headline } from "@/components/new/AffordPanel";

/**
 * Shared loaders for the new Tally pilot (app/new). Same rules as the
 * classic pages: only live accounts and connections count (lib/liveAccounts),
 * and every balance is converted the way net worth converts it, so the
 * pieces always add up to the headline figure.
 */

export type AccountGroup = "cash" | "savings" | "invested" | "card" | "loan" | "other";

export const GROUP_LABEL: Record<AccountGroup, string> = {
  cash: "Cash",
  savings: "Savings",
  invested: "Invested",
  card: "Credit cards",
  loan: "Loans",
  other: "Other",
};

export interface NewAccount {
  id: string;
  name: string;
  mask: string | null;
  group: AccountGroup;
  /** In the account's own currency, as stored. */
  balance: number;
  currency: string;
  /** In the net-worth currency; positive for both assets and debts. */
  converted: number;
  creditLimit: number | null;
  itemId: string | null;
  institution: string | null;
  isManual: boolean;
}

export interface NewItem {
  id: string;
  institution: string;
  state: ConnectionState;
}

function groupFor(a: { type: string; subtype: string | null; countsAsCash: boolean | null }): AccountGroup {
  if (a.type === "depository") return countsAsCash(a) ? "cash" : "savings";
  if (a.type === "investment") return "invested";
  if (a.type === "credit") return "card";
  if (a.type === "loan") return "loan";
  return "other";
}

const IDLE = { refreshing: false, linking: false, justReconnected: false, refreshFailed: false };

export async function loadAccounts(userId: string): Promise<{ accounts: NewAccount[]; items: NewItem[] }> {
  const [rows, itemRows] = await Promise.all([
    db
      .select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        nickname: schema.accounts.nickname,
        mask: schema.accounts.mask,
        type: schema.accounts.type,
        subtype: schema.accounts.subtype,
        countsAsCash: schema.accounts.countsAsCash,
        currentBalance: schema.accounts.currentBalance,
        currency: schema.accounts.currency,
        creditLimit: schema.accounts.creditLimit,
        itemId: schema.accounts.itemId,
        isManual: schema.accounts.isManual,
        institution: schema.plaidItems.institutionName,
      })
      .from(schema.accounts)
      .leftJoin(schema.plaidItems, eq(schema.accounts.itemId, schema.plaidItems.id))
      .where(and(eq(schema.accounts.userId, userId), liveAccount)),
    db
      .select({
        id: schema.plaidItems.id,
        institutionName: schema.plaidItems.institutionName,
        status: schema.plaidItems.status,
        lastSyncedAt: schema.plaidItems.lastSyncedAt,
        transactionsUpdateStatus: schema.plaidItems.transactionsUpdateStatus,
      })
      .from(schema.plaidItems)
      .where(and(eq(schema.plaidItems.userId, userId), liveItem)),
  ]);

  const accounts = await Promise.all(
    rows.map(async (r) => {
      const balance = r.currentBalance ?? 0;
      return {
        id: r.id,
        name: accountDisplayName(r.name, r.nickname),
        mask: r.mask,
        group: groupFor(r),
        balance,
        currency: r.currency,
        converted: await toNetWorthCurrency(balance, r.currency),
        creditLimit: r.creditLimit,
        itemId: r.itemId,
        institution: r.institution,
        isManual: r.isManual,
      } satisfies NewAccount;
    }),
  );
  accounts.sort((a, b) => Math.abs(b.converted) - Math.abs(a.converted));

  const items = itemRows.map((i) => ({
    id: i.id,
    institution: i.institutionName ?? "Your bank",
    state: connectionState({ ...i, badge: itemStatusToBadge(i.status, i.lastSyncedAt, i.transactionsUpdateStatus) }, IDLE),
  }));
  return { accounts, items };
}

export interface Composition {
  cash: number;
  savings: number;
  invested: number;
  other: number;
  owned: number;
  cards: number;
  loans: number;
  owed: number;
}

/** What you own and owe, by kind -- the same sums net worth is made of. */
export function composition(accounts: NewAccount[]): Composition {
  const sum = (g: AccountGroup) => accounts.filter((a) => a.group === g).reduce((s, a) => s + a.converted, 0);
  const c = { cash: sum("cash"), savings: sum("savings"), invested: sum("invested"), other: sum("other"), cards: sum("card"), loans: sum("loan") };
  return { ...c, owned: c.cash + c.savings + c.invested + c.other, owed: c.cards + c.loans };
}

// ── formatting ─────────────────────────────────────────────────────────────

/** Whole dollars for headlines: "$48,920", "−$168". */
export function dollars(cents: number): string {
  return formatCents(Math.round(cents / 100) * 100).replace(/\.00$/, "");
}

/** "+$1,140" / "−$96" -- whole dollars, always signed. */
export function signedDollars(cents: number): string {
  const d = dollars(Math.abs(cents));
  return cents < 0 ? `−${d}` : `+${d}`;
}

/** "Nov 30" from an ISO date. */
export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Fri, Nov 6" from an ISO date. */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Alpha, Beta and Gamma". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The one-line answer to "am I okay?" over the forecast's window, shared by Now and Forecast. */
export function forecastHeadline(forecast: Forecast, days: number): Headline {
  if (!forecast.headline) {
    return { tone: "ink", title: "Here's where you stand.", sub: "Tally hasn't spotted a paycheque yet, so it can't look ahead. Add your pay in Settings and this will tell you what's coming." };
  }
  if (forecast.headline.kind === "shortfall") {
    const causes = forecast.headline.causes.slice(0, 2).map((c) => c.label);
    return {
      tone: "coral",
      title: `Heads up: ${shortDate(forecast.headline.date)} gets tight.`,
      sub: `Your cash would dip under ${forecast.cushion > 0 ? `your ${dollars(forecast.cushion)} buffer` : "$0"}${causes.length ? `, mostly from ${listNames(causes)}` : ""}.`,
    };
  }
  return {
    tone: "lime",
    title: `You're in good shape for the next ${days} days.`,
    sub: `Every bill Tally knows about is covered. Your lowest point is ${dollars(forecast.lowest.amount)}, on ${shortDate(forecast.lowest.date)}.`,
  };
}
