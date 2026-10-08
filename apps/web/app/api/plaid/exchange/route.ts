import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode } from "plaid";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { plaidClient, encryptAccessToken, plaidErrorCode, PLAID_COUNTRY_CODES } from "@/lib/plaid";
import { upsertAccountsForItem } from "@/lib/plaidAccounts";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { runSyncStep, type SyncFailure } from "@/lib/syncSteps";
import { recordAudit } from "@/lib/audit";
import { findDisconnectedItem, matchKeptAccounts, reattachItem } from "@/lib/reattach";

const bodySchema = z.object({
  publicToken: z.string().min(1),
  metadata: z
    .object({
      institution: z.object({ institution_id: z.string(), name: z.string() }).nullable().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { publicToken, metadata } = parsed.data;

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    const itemRes = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = itemRes.data.item.institution_id ?? metadata?.institution?.institution_id ?? null;

    let institutionName = metadata?.institution?.name ?? null;
    if (institutionId) {
      try {
        const inst = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: PLAID_COUNTRY_CODES as CountryCode[],
          options: { include_optional_metadata: true },
        });
        institutionName = inst.data.institution.name;
        await db
          .insert(schema.institutions)
          .values({
            id: institutionId,
            name: inst.data.institution.name,
            logoBase64: inst.data.institution.logo ?? null,
            primaryColor: inst.data.institution.primary_color ?? null,
            url: inst.data.institution.url ?? null,
            oauth: inst.data.institution.oauth,
            products: inst.data.institution.products,
          })
          .onConflictDoUpdate({
            target: schema.institutions.id,
            set: {
              name: inst.data.institution.name,
              logoBase64: inst.data.institution.logo ?? null,
              primaryColor: inst.data.institution.primary_color ?? null,
              products: inst.data.institution.products,
            },
          });
      } catch (err) {
        console.error("institutions/get_by_id failed, continuing without logo", err);
      }
    }

    const token = encryptAccessToken(accessToken);
    const consentedProducts = itemRes.data.item.consented_products ?? [];
    const availableProducts = itemRes.data.item.available_products ?? [];

    // Reconnecting a bank the user disconnected earlier: reuse that item so
    // its kept accounts and history carry on (lib/reattach.ts). Only when at
    // least one account lines up -- a different login at the same bank
    // (say, a partner's) shouldn't be folded into the old one.
    const previous = institutionId ? await findDisconnectedItem(userId, institutionId) : null;
    let matches = new Map<string, string>();
    if (previous) {
      const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
      matches = await matchKeptAccounts(previous.id, accountsRes.data.accounts);
    }

    let item: { id: string };
    if (previous && matches.size > 0) {
      await reattachItem({ itemId: previous.id, userId, plaidItemId, institutionName, token, consentedProducts, availableProducts, accountMatches: matches });
      item = previous;
    } else {
      const [inserted] = await db
        .insert(schema.plaidItems)
        .values({
          userId,
          plaidItemId,
          institutionId,
          institutionName,
          ...token,
          status: "healthy",
          consentedProducts,
          availableProducts,
        })
        .returning({ id: schema.plaidItems.id });
      if (!inserted) throw new Error("Failed to insert plaid_items row");
      item = inserted;

      await recordAudit({
        userId,
        action: "plaid_item.connected",
        entity: "plaid_items",
        entityId: item.id,
        after: { institutionName, institutionId },
      });
    }

    await upsertAccountsForItem(item.id, userId, accessToken);

    // Kick off the first pull of everything immediately rather than waiting
    // for a webhook — failure here doesn't fail the link, the item just
    // stays un-synced for that product until the next webhook/manual/cron
    // sync retries it. Holdings/liabilities/investment-tx no-op quietly for
    // institutions or account types that don't support them (§6.4, §6.5).
    // Each step runs independently (runSyncStep) so one down product — e.g.
    // Plaid returning INSTITUTION_NOT_RESPONDING for liabilities — doesn't
    // skip the steps after it; `failures` goes back to the client so the UI
    // can tell the user what didn't come through instead of staying silent.
    const failures: SyncFailure[] = [];
    await runSyncStep("transactions", () => syncTransactionsForItem(item.id, "initial"), failures);
    await runSyncStep("holdings", () => syncHoldingsForItem(item.id, "initial"), failures);
    await runSyncStep("investments", () => syncInvestmentTransactionsForItem(item.id, "initial"), failures);
    await runSyncStep("liabilities", () => syncLiabilitiesForItem(item.id, "initial"), failures);

    return NextResponse.json({ ok: true, itemId: item.id, institutionName, failures, reconnected: previous !== null && matches.size > 0 });
  } catch (err) {
    console.error("plaid/exchange failed", err);
    // `code` lets the client pick plain-language copy (@tally/core/syncDialog
    // connectErrorCopy); it's never shown as-is.
    return NextResponse.json({ error: "Failed to link account", code: plaidErrorCode(err) ?? null }, { status: 502 });
  }
}
