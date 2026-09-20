import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApiKeyUserId } from "@/lib/apiKeyAuth";
import { categorizeTransactions } from "@/lib/categorize";
import { accountDisplayName } from "@tally/core/accountName";
import { AmbiguousAccountError, matchAccountByCardName, parseAmountToCents, parseShortcutDate } from "@/lib/shortcutTransaction";

// Public intake endpoint for the Apple Shortcuts automation: "when I make an
// Apple Pay transaction" -> get the notification's Transaction/Amount/
// Card/Date text -> POST it here. Everything Shortcuts hands over is a raw
// string (currency symbols, "Sep 19, 2026 at 7:43 PM", a card's display
// name) -- lib/shortcutTransaction.ts does the parsing/matching, this route
// just wires it to an insert. Auth is a per-user API key (see
// lib/apiKeyAuth.ts, minted from Settings), never a NextAuth cookie or
// mobile JWT -- this is the one route meant to be called from outside both
// apps.
const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.string().trim().min(1),
  card: z.string().trim().min(1),
  date: z.string().trim().min(1),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireApiKeyUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, amount, card, date } = parsed.data;

  const signedCents = parseAmountToCents(amount);
  if (signedCents == null) {
    return NextResponse.json({ error: `Couldn't parse an amount out of "${amount}"` }, { status: 422 });
  }

  const postedDate = parseShortcutDate(date);
  if (!postedDate) {
    return NextResponse.json({ error: `Couldn't parse a date out of "${date}"` }, { status: 422 });
  }

  const accounts = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname, officialName: schema.accounts.officialName, mask: schema.accounts.mask, currency: schema.accounts.currency })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));

  let account;
  try {
    account = matchAccountByCardName(card, accounts);
  } catch (err) {
    if (err instanceof AmbiguousAccountError) {
      return NextResponse.json(
        {
          error: `"${card}" matches more than one account -- give one of them a distinct nickname in Accounts & connections and try again.`,
          candidates: err.candidates.map((a) => accountDisplayName(a.name, a.nickname)),
        },
        { status: 422 },
      );
    }
    throw err;
  }
  if (!account) {
    return NextResponse.json(
      {
        error: `No account matches "${card}".`,
        availableAccounts: accounts.map((a) => accountDisplayName(a.name, a.nickname)),
      },
      { status: 422 },
    );
  }

  // No sign in the notification text (the overwhelmingly common case) means
  // a purchase -- store negative, per the amount column's "expenses
  // negative, income positive" convention (schema.ts). An explicit "-"
  // (Shortcuts occasionally reports a refund/credit that way) flips it.
  const storedAmount = signedCents < 0 ? Math.abs(signedCents) : -signedCents;

  const [created] = await db
    .insert(schema.transactions)
    .values({
      userId,
      accountId: account.id,
      amount: storedAmount,
      currency: account.currency,
      postedDate,
      name,
      // categorySource "plaid" (not "manual") so categorizeTransactions
      // below is allowed to apply the user's rules to it, same as a row a
      // real Plaid sync just inserted -- see lib/categorize.ts's source
      // filter. isManual stays true regardless: sync only ever matches rows
      // by plaidTransactionId, which this row doesn't have, so it's safe
      // from being touched or duplicated by the next real sync.
      categorySource: "plaid",
      isManual: true,
      source: "shortcut",
    })
    .returning();
  if (!created) {
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }

  await categorizeTransactions(userId, [created.id]);

  const [final] = await db
    .select({
      id: schema.transactions.id,
      name: schema.transactions.name,
      amount: schema.transactions.amount,
      currency: schema.transactions.currency,
      postedDate: schema.transactions.postedDate,
      accountId: schema.transactions.accountId,
      categoryId: schema.transactions.categoryId,
      categoryName: schema.categories.name,
    })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(eq(schema.transactions.id, created.id))
    .limit(1);

  return NextResponse.json(
    {
      transaction: {
        ...final,
        accountName: accountDisplayName(account.name, account.nickname),
      },
    },
    { status: 201 },
  );
}
