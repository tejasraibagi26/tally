import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { merchantLogoKey, ownMerchantLogo } from "@tally/core/merchantLogo";

interface LogoSource {
  id: string;
  merchantName: string | null;
  logoUrl: string | null;
  counterparties: unknown;
}

/**
 * Logo per transaction id: its own Plaid logo or counterparty logo
 * (@tally/core/merchantLogo), else one from another of the user's
 * transactions with the same merchant name. Null means the row shows its
 * first letter.
 */
export async function resolveMerchantLogos(userId: string, rows: LogoSource[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const missingKeys = new Set<string>();
  for (const r of rows) {
    const own = ownMerchantLogo(r.logoUrl, r.counterparties);
    out.set(r.id, own);
    const key = merchantLogoKey(r.merchantName);
    if (!own && key) missingKeys.add(key);
  }
  if (missingKeys.size === 0) return out;

  const nameKey = sql<string>`lower(trim(${schema.transactions.merchantName}))`;
  const shared = await db
    .select({ key: nameKey, logoUrl: sql<string>`max(${schema.transactions.logoUrl})` })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.logoUrl), inArray(nameKey, [...missingKeys])))
    .groupBy(nameKey);
  const byKey = new Map(shared.map((s) => [s.key, ownMerchantLogo(s.logoUrl, null)]));

  for (const r of rows) {
    if (out.get(r.id)) continue;
    const key = merchantLogoKey(r.merchantName);
    out.set(r.id, (key && byKey.get(key)) || null);
  }
  return out;
}
