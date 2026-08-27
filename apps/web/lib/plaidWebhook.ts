import { createHash } from "node:crypto";
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";
import { plaidClient } from "@/lib/plaid";

// Plaid rotates verification keys rarely; cache by kid for the process lifetime.
// A kid miss triggers exactly one refetch, per Plaid's guidance.
const keyCache = new Map<string, Record<string, unknown>>();

async function getVerificationKey(kid: string) {
  if (keyCache.has(kid)) return keyCache.get(kid)!;
  const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const key = res.data.key as unknown as Record<string, unknown>;
  keyCache.set(kid, key);
  return key;
}

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

/**
 * Verifies a Plaid webhook per §6.7: JWT signature (ES256) via the key the
 * kid points to, body hash match, and freshness. Returns false on ANY
 * failure — callers must discard the event, not process it "just in case".
 */
export async function verifyPlaidWebhook(rawBody: string, verificationHeader: string | null): Promise<boolean> {
  if (!verificationHeader) return false;

  try {
    const { kid, alg } = decodeProtectedHeader(verificationHeader);
    if (!kid || alg !== "ES256") return false;

    const jwk = await getVerificationKey(kid);
    const publicKey = await importJWK(jwk as unknown as JWK, "ES256");

    const { payload } = await jwtVerify(verificationHeader, publicKey, { maxTokenAge: MAX_WEBHOOK_AGE_SECONDS });

    const expectedHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    if (payload.request_body_sha256 !== expectedHash) return false;

    return true;
  } catch (err) {
    console.error("plaid webhook verification failed", err);
    return false;
  }
}
