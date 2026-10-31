import { createHash } from "node:crypto";
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";
import { plaidClient } from "@/lib/plaid";

// Plaid rotates verification keys rarely; cache by kid for the process lifetime.
// A kid miss triggers exactly one refetch, per Plaid's guidance.
const keyCache = new Map<string, Record<string, unknown>>();

// The kid comes from a header nobody has verified yet, so without this any
// caller could make every request cost a Plaid API call with a fresh made-up
// kid. A kid Plaid didn't recognise isn't asked about again for a while, and
// the set is cleared outright if it grows past a bound.
const unknownKids = new Map<string, number>();
const UNKNOWN_KID_TTL_MS = 10 * 60 * 1000;
const MAX_UNKNOWN_KIDS = 1000;

async function getVerificationKey(kid: string): Promise<Record<string, unknown> | null> {
  const cached = keyCache.get(kid);
  if (cached) return cached;

  const missedAt = unknownKids.get(kid);
  if (missedAt !== undefined && Date.now() - missedAt < UNKNOWN_KID_TTL_MS) return null;

  try {
    const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
    const key = res.data.key as unknown as Record<string, unknown>;
    keyCache.set(kid, key);
    unknownKids.delete(kid);
    return key;
  } catch (err) {
    if (unknownKids.size >= MAX_UNKNOWN_KIDS) unknownKids.clear();
    unknownKids.set(kid, Date.now());
    throw err;
  }
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
    if (!jwk) return false;
    // A retired key (Plaid sets expired_at, in seconds) must not verify anything.
    // It stays cached, so a replay doesn't refetch it either.
    if (typeof jwk.expired_at === "number" && jwk.expired_at * 1000 < Date.now()) return false;
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
