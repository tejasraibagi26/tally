import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode } from "plaid";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { plaidClient, encryptAccessToken, PLAID_COUNTRY_CODES } from "@/lib/plaid";
import { upsertAccountsForItem } from "@/lib/plaidAccounts";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { runSyncStep, type SyncFailure } from "@/lib/syncSteps";
import { recordAudit } from "@/lib/audit";

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

    const { accessTokenCiphertext, accessTokenIv, accessTokenTag } = encryptAccessToken(accessToken);

    const [item] = await db
      .insert(schema.plaidItems)
      .values({
        userId,
        plaidItemId,
        institutionId,
        institutionName,
        accessTokenCiphertext,
        accessTokenIv,
        accessTokenTag,
        status: "healthy",
        consentedProducts: itemRes.data.item.consented_products ?? [],
        availableProducts: itemRes.data.item.available_products ?? [],
      })
      .returning({ id: schema.plaidItems.id });

    if (!item) throw new Error("Failed to insert plaid_items row");

    await recordAudit({
      userId,
      action: "plaid_item.connected",
      entity: "plaid_items",
      entityId: item.id,
      after: { institutionName, institutionId },
    });

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

    return NextResponse.json({ ok: true, itemId: item.id, institutionName, failures });
  } catch (err) {
    console.error("plaid/exchange failed", err);
    return NextResponse.json({ error: "Failed to link account" }, { status: 502 });
  }
}
