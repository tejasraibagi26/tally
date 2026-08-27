import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import {
  plaidClient,
  getAccessToken,
  PLAID_PRODUCTS,
  PLAID_ADDITIONAL_PRODUCTS,
  PLAID_COUNTRY_CODES,
  PLAID_WEBHOOK_URL,
  PLAID_REDIRECT_URI,
} from "@/lib/plaid";

const bodySchema = z.object({
  mode: z.enum(["create", "update"]),
  itemId: z.string().uuid().optional(),
});

// Server-side only: builds a short-lived Link token. This is the only Plaid
// string that ever reaches the browser (never an access_token).
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
  const { mode, itemId } = parsed.data;

  try {
    if (mode === "update") {
      if (!itemId) return NextResponse.json({ error: "itemId required for update mode" }, { status: 400 });

      const [item] = await db
        .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
        .from(schema.plaidItems)
        .where(eq(schema.plaidItems.id, itemId))
        .limit(1);
      if (!item || item.userId !== userId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const accessToken = await getAccessToken(itemId);
      const res = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Tally",
        access_token: accessToken,
        language: "en",
        country_codes: PLAID_COUNTRY_CODES as CountryCode[],
        webhook: PLAID_WEBHOOK_URL,
        update: { account_selection_enabled: true },
      });
      return NextResponse.json({ linkToken: res.data.link_token });
    }

    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Tally",
      products: PLAID_PRODUCTS as Products[],
      additional_consented_products: PLAID_ADDITIONAL_PRODUCTS as Products[],
      language: "en",
      country_codes: PLAID_COUNTRY_CODES as CountryCode[],
      webhook: PLAID_WEBHOOK_URL,
      redirect_uri: PLAID_REDIRECT_URI,
    });
    return NextResponse.json({ linkToken: res.data.link_token });
  } catch (err) {
    console.error("plaid/link-token failed", err);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 502 });
  }
}
