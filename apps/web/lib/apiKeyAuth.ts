import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const KEY_PREFIX = "tly_";
const PREFIX_DISPLAY_LEN = 12; // "tly_" + 8 chars, enough to tell keys apart in a list

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Mints a new key. Only the hash is ever persisted -- the raw `key` must be
 * shown to the caller once and can never be recovered afterward. */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { key, keyHash: hashKey(key), keyPrefix: key.slice(0, PREFIX_DISPLAY_LEN) };
}

/** Resolves a raw `Authorization: Bearer <key>` value to the owning userId,
 * or null if the key is missing/unknown. Never throws. Touches lastUsedAt
 * (best-effort, not awaited-for-correctness) so a settings page can show
 * "last used" without every call paying for a second round trip. */
export async function verifyApiKey(key: string): Promise<string | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashKey(key);
  const row = await db.query.apiKeys.findFirst({ where: eq(schema.apiKeys.keyHash, keyHash) });
  if (!row) return null;
  void db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, row.id));
  return row.userId;
}

/** Throws if the request doesn't carry a valid `Authorization: Bearer <api key>`
 * header. Parallel to lib/session.ts's requireUserId, but for the API-key
 * auth path only -- routes meant for automation callers (not the web app or
 * mobile app) should use this instead so a leaked NextAuth cookie or mobile
 * JWT can never be replayed against them. */
export async function requireApiKeyUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const userId = await verifyApiKey(authHeader.slice(7));
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}
