import { Configuration, PlaidApi, PlaidEnvironments, type CountryCode, type Products } from "plaid";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

// Server-only client. PLAID_SECRET and every access_token this module touches
// must never reach a client component or an API response body.
export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS ?? "transactions").split(",") as Products[];
export const PLAID_ADDITIONAL_PRODUCTS = (process.env.PLAID_ADDITIONAL_CONSENTED_PRODUCTS ?? "")
  .split(",")
  .filter(Boolean) as Products[];
export const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES ?? "US").split(",") as CountryCode[];

// A blank `KEY=` line in .env parses to "" (dotenv), not undefined — sending
// `webhook: ""` or `redirect_uri: ""` to /link/token/create fails Plaid's URL
// validation. Coalesce to undefined so an unconfigured tunnel just omits the
// field instead of breaking Link entirely.
export const PLAID_WEBHOOK_URL = process.env.PLAID_WEBHOOK_URL || undefined;
export const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || undefined;

/** Decrypts the access token for one item. Call sites are server-only Plaid calls. */
export async function getAccessToken(itemId: string): Promise<string> {
  const [item] = await db
    .select({
      ciphertext: schema.plaidItems.accessTokenCiphertext,
      iv: schema.plaidItems.accessTokenIv,
      tag: schema.plaidItems.accessTokenTag,
    })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, itemId))
    .limit(1);

  if (!item) throw new Error(`Plaid item ${itemId} not found`);

  return decryptSecret({ ciphertext: item.ciphertext, iv: item.iv, tag: item.tag });
}

export function encryptAccessToken(accessToken: string) {
  const { ciphertext, iv, tag } = encryptSecret(accessToken);
  return {
    accessTokenCiphertext: ciphertext,
    accessTokenIv: iv,
    accessTokenTag: tag,
  };
}

/** Extracts Plaid's `error_code` from a failed SDK call (an Axios error with Plaid's JSON body), if present. */
export function plaidErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error_code?: string } } }).response;
    return response?.data?.error_code;
  }
  return undefined;
}
